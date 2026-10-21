import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from './App.jsx';
import ChatPage from './pages/ChatPage.jsx';
import { assistantApi, taskApi } from './api.js';

vi.mock('./api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    assistantApi: {
      sendMessage: vi.fn(),
      confirmDelete: vi.fn(),
    },
    taskApi: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      planTask: vi.fn(),
      answerPrompt: vi.fn(),
    },
  };
});

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
  });

  const installRecognition = () => {
    class MockRecognition {
      static instances = [];

      constructor() {
        this.start = vi.fn();
        this.stop = vi.fn();
        this.abort = vi.fn();
        MockRecognition.instances.push(this);
      }
    }
    window.SpeechRecognition = MockRecognition;
    return MockRecognition;
  };

  const installSynthesis = () => {
    class MockUtterance {
      constructor(text) {
        this.text = text;
      }
    }
    let speaking = false;
    const utterances = [];
    const synthesis = {
      speak: vi.fn((utterance) => {
        speaking = true;
        utterances.push(utterance);
      }),
      cancel: vi.fn(() => { speaking = false; }),
    };
    Object.defineProperty(synthesis, 'speaking', { get: () => speaking });
    window.speechSynthesis = synthesis;
    window.SpeechSynthesisUtterance = MockUtterance;
    return {
      synthesis,
      utterances,
      finish(utterance = utterances.at(-1)) {
        act(() => {
          speaking = false;
          utterance?.onend?.();
        });
      },
      fail(utterance = utterances.at(-1)) {
        act(() => {
          speaking = false;
          utterance?.onerror?.({ error: 'synthesis-failed' });
        });
      },
    };
  };

  const emitTranscript = (recognition, text) => {
    act(() => {
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: text } }],
      });
    });
  };

  it('renders chat UI and sends a task message via backend contract', async () => {
    assistantApi.sendMessage.mockResolvedValue({
      message: 'Found 2 tasks.',
      action: {
        type: 'count',
        status: 'completed',
        counts: { total: 2, pending: 1, inProgress: 0, completed: 1, overdue: 0 },
      },
    });

    const user = userEvent.setup();
    render(<ChatPage />);

    const textarea = screen.getByLabelText(/message the ai assistant/i);
    await user.type(textarea, 'How many tasks do I have?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(assistantApi.sendMessage).toHaveBeenCalledWith('How many tasks do I have?'));
    expect(await screen.findByText('Found 2 tasks.')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('keeps the existing tasks route accessible alongside chat', async () => {
    taskApi.list.mockResolvedValue([{
      _id: 'task-1',
      title: 'Saved project task',
      description: 'Existing task data remains visible.',
      status: 'pending',
      dueDate: null,
      updatedAt: new Date().toISOString(),
    }]);
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/tasks']}><App /></MemoryRouter>);

    expect((await screen.findAllByText('Saved project task')).length).toBeGreaterThan(0);
    expect(taskApi.list).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('link', { name: 'AI chat' }));
    expect(await screen.findByLabelText(/message the ai assistant/i)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'All tasks' }));
    expect((await screen.findAllByText('Saved project task')).length).toBeGreaterThan(0);
  });

  it('loads the existing dashboard metrics and recent tasks from the task API', async () => {
    taskApi.list.mockResolvedValue([
      {
        _id: 'task-1',
        title: 'Dashboard pending task',
        description: 'Still visible from the dashboard.',
        status: 'pending',
        dueDate: null,
        updatedAt: new Date().toISOString(),
      },
      {
        _id: 'task-2',
        title: 'Dashboard completed task',
        description: '',
        status: 'completed',
        dueDate: null,
        updatedAt: new Date().toISOString(),
      },
    ]);
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);

    expect(await screen.findByText('Good work starts with a clear view.')).toBeInTheDocument();
    expect(await screen.findAllByText('Dashboard pending task')).not.toHaveLength(0);
    expect(screen.getAllByText('Dashboard completed task')).not.toHaveLength(0);
    expect(screen.getAllByText('2')).toHaveLength(2);
    expect(taskApi.list).toHaveBeenCalledOnce();
  });

  it('uses plan mode and answer mode through the existing AI endpoints', async () => {
    taskApi.planTask.mockResolvedValue({
      summary: 'Ship the onboarding flow',
      priority: 'high',
      estimatedHours: 3,
      steps: ['Write copy', 'Build flow', 'Ship'],
      mode: 'plan',
    });
    taskApi.answerPrompt.mockResolvedValue('Use a concise onboarding checklist.');

    const user = userEvent.setup();
    render(<ChatPage />);

    await user.click(screen.getByRole('tab', { name: /plan a task/i }));
    const titleInput = screen.getByLabelText(/message the ai assistant/i);
    await user.type(titleInput, 'Create onboarding flow');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(taskApi.planTask).toHaveBeenCalledWith({ description: 'Create onboarding flow' }));
    expect(await screen.findByText('Ship the onboarding flow')).toBeInTheDocument();
    expect(screen.getByText('high priority · 3 hours')).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Write copy');

    await user.click(screen.getByRole('tab', { name: /ask ai/i }));
    await user.clear(screen.getByLabelText(/message the ai assistant/i));
    await user.type(screen.getByLabelText(/message the ai assistant/i), 'Draft a small intro paragraph');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(taskApi.answerPrompt).toHaveBeenCalledWith('Draft a small intro paragraph'));
    expect(await screen.findByText('Use a concise onboarding checklist.')).toBeInTheDocument();
  });

  it('shows a plan-mode network error without rendering a fake plan', async () => {
    taskApi.planTask.mockRejectedValue(new Error('Could not reach the Task Manager API. Check that the backend is running.'));

    const user = userEvent.setup();
    render(<ChatPage />);
    await user.click(screen.getByRole('tab', { name: /plan a task/i }));
    await user.type(screen.getByLabelText(/message the ai assistant/i), 'Prepare the launch');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the Task Manager API/);
    expect(screen.queryByText(/priority · \d+ hours/)).not.toBeInTheDocument();
  });

  it('prevents duplicate sends while loading and shows backend errors', async () => {
    let rejectRequest;
    assistantApi.sendMessage.mockImplementation(() => new Promise((_, reject) => {
      rejectRequest = reject;
    }));

    const user = userEvent.setup();
    render(<ChatPage />);

    const textarea = screen.getByLabelText(/message the ai assistant/i);
    await user.type(textarea, 'List tasks');
    const form = textarea.closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(assistantApi.sendMessage).toHaveBeenCalledOnce());
    const sendButton = screen.getByRole('button', { name: /send message/i });
    expect(sendButton).toBeDisabled();
    await act(async () => rejectRequest({ status: 500, message: 'AI provider issue' }));
    expect(await screen.findByText(/AI provider issue/i)).toBeInTheDocument();
  });

  it('distinguishes the app IP rate limit from the provider quota limit', async () => {
    const user = userEvent.setup();
    const composer = () => screen.getByLabelText(/message the ai assistant/i);

    assistantApi.sendMessage.mockRejectedValueOnce({
      status: 429,
      message: 'Too many AI requests from this IP. Please try again later.',
    });
    const { unmount } = render(<ChatPage />);
    await user.type(composer(), 'List my tasks');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/app’s AI request limit for this IP/i);

    unmount();
    assistantApi.sendMessage.mockRejectedValueOnce({
      status: 429,
      message: 'AI service rate limit reached with provider. Please try again shortly.',
    });
    render(<ChatPage />);
    await user.type(composer(), 'Create a task to review the report');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/AI provider is rate-limiting requests/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/check your provider quota/i);
  });

  it('explains how to enable the task assistant when the backend reports it unavailable', async () => {
    assistantApi.sendMessage.mockRejectedValue({
      status: 404,
      message: 'Task assistant is not available.',
    });
    const user = userEvent.setup();
    render(<ChatPage />);

    await user.type(screen.getByLabelText(/message the ai assistant/i), 'List my tasks');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'AI_ASSISTANT_DEV_IDENTITY_ENABLED=true'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('never enable the development identity in production');
    expect(assistantApi.sendMessage).toHaveBeenCalledOnce();
  });

  it('handles confirmation dialogs and speech API fallback', async () => {
    assistantApi.sendMessage.mockResolvedValue({
      message: 'Confirm deletion of "Old task".',
      action: {
        type: 'delete',
        status: 'confirmation_required',
        confirmation: { token: 'a'.repeat(64), task: { title: 'Old task' } },
      },
    });
    assistantApi.confirmDelete.mockResolvedValue({
      message: 'Deleted task "Old task".',
      action: { type: 'delete', status: 'completed', task: { id: '1', title: 'Old task' } },
    });

    const user = userEvent.setup();
    render(<ChatPage />);

    await user.type(screen.getByLabelText(/message the ai assistant/i), 'Delete Old task');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText(/Confirm deleting/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm deletion/i }));
    await waitFor(() => expect(assistantApi.confirmDelete).toHaveBeenCalledWith('a'.repeat(64)));
    expect(await screen.findByText(/Deleted task "Old task"./i)).toBeInTheDocument();

    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    render(<ChatPage />);
    expect(screen.getAllByText(/speech input isn’t supported here/i).length).toBeGreaterThan(0);
  });

  it('keeps automatic speech off by default and explains missing synthesis support', async () => {
    const user = userEvent.setup();
    render(<ChatPage />);

    expect(screen.getByRole('checkbox', { name: /automatically speak assistant replies/i })).not.toBeChecked();
    expect(screen.getByText(/speech synthesis is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /speak response aloud/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/message the ai assistant/i)).toBeEnabled();
    await user.type(screen.getByLabelText(/message the ai assistant/i), 'Typed chat still works');
  });

  it('speaks and stops assistant responses without overlapping playback', async () => {
    const speech = installSynthesis();
    taskApi.answerPrompt
      .mockResolvedValueOnce('First spoken response.')
      .mockResolvedValueOnce('Second spoken response.')
      .mockResolvedValueOnce('Long response '.repeat(350));

    const user = userEvent.setup();
    render(<ChatPage />);
    await user.click(screen.getByRole('tab', { name: /ask ai/i }));

    const composer = screen.getByLabelText(/message the ai assistant/i);
    await user.type(composer, 'First question');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText('First spoken response.')).toBeInTheDocument();
    expect(speech.synthesis.speak).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /speak response aloud/i }));
    expect(speech.synthesis.speak).toHaveBeenCalledTimes(1);
    expect(speech.utterances[0].text).toBe('First spoken response.');

    await user.type(composer, 'Second question');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(await screen.findByText('Second spoken response.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /speak response aloud/i })[1]);
    expect(speech.synthesis.cancel).toHaveBeenCalled();
    expect(speech.synthesis.speak).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: /stop speaking response/i }));
    expect(speech.synthesis.cancel).toHaveBeenCalledTimes(4);

    await user.click(screen.getByRole('checkbox', { name: /automatically speak assistant replies/i }));
    await user.type(composer, 'Third question');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(speech.synthesis.speak).toHaveBeenCalledTimes(3));
    expect(speech.utterances[2].text.length).toBe(4000);
    expect(await screen.findByText(/first 4,000 characters/i)).toBeInTheDocument();
  });

  it('runs voice mode sequentially and submits a recognized utterance only once', async () => {
    const Recognition = installRecognition();
    const speech = installSynthesis();
    assistantApi.sendMessage.mockResolvedValue({
      message: 'You have two saved tasks.',
      action: { type: 'count', status: 'completed', counts: { total: 2, pending: 1, inProgress: 0, completed: 1, overdue: 0 } },
    });

    const user = userEvent.setup();
    render(<ChatPage />);
    await user.click(screen.getByRole('button', { name: /start voice conversation/i }));

    expect(Recognition.instances).toHaveLength(1);
    expect(Recognition.instances[0].start).toHaveBeenCalledOnce();
    expect(screen.getByText('Listening', { selector: '.chat-voice-state' })).toBeInTheDocument();
    emitTranscript(Recognition.instances[0], 'How many tasks do I have?');
    emitTranscript(Recognition.instances[0], 'How many tasks do I have?');
    act(() => Recognition.instances[0].onend?.());

    await waitFor(() => expect(assistantApi.sendMessage).toHaveBeenCalledTimes(1));
    expect(assistantApi.sendMessage).toHaveBeenCalledWith('How many tasks do I have?');
    expect(await screen.findByText('You have two saved tasks.')).toBeInTheDocument();
    expect(speech.synthesis.speak).toHaveBeenCalledOnce();
    expect(Recognition.instances[0].start).toHaveBeenCalledOnce();

    speech.finish();
    await waitFor(() => expect(Recognition.instances).toHaveLength(2));
    expect(Recognition.instances[1].start).toHaveBeenCalledOnce();
    expect(speech.synthesis.speaking).toBe(false);

    await user.click(screen.getByRole('button', { name: /stop voice conversation/i }));
    expect(Recognition.instances[1].abort).toHaveBeenCalledOnce();
    expect(screen.getByText('Stopped', { selector: '.chat-voice-state' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /automatically speak assistant replies/i })).not.toBeChecked();
  });

  it('preserves manual speech-to-text drafts and handles permission and backend errors in voice mode', async () => {
    const Recognition = installRecognition();
    const user = userEvent.setup();
    render(<ChatPage />);

    await user.click(screen.getByRole('button', { name: /start speech input/i }));
    emitTranscript(Recognition.instances[0], 'Draft, do not send');
    expect(screen.getByLabelText(/message the ai assistant/i)).toHaveValue('Draft, do not send');
    expect(assistantApi.sendMessage).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /start voice conversation/i }));
    const voiceRecognition = Recognition.instances[1];
    act(() => voiceRecognition.onerror?.({ error: 'not-allowed' }));
    expect(await screen.findByText(/microphone permission was denied/i)).toBeInTheDocument();
    expect(screen.getByText('Stopped', { selector: '.chat-voice-state' })).toBeInTheDocument();

    assistantApi.sendMessage.mockRejectedValueOnce({ status: 503, message: 'Assistant unavailable' });
    await user.click(screen.getByRole('button', { name: /start voice conversation/i }));
    emitTranscript(Recognition.instances[2], 'List my tasks');
    expect(await screen.findByText(/assistant unavailable/i)).toBeInTheDocument();
    expect(await screen.findByText(/voice conversation stopped because the assistant request failed/i)).toBeInTheDocument();
    expect(assistantApi.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('stops speech playback when voice mode ends and reports synthesis errors', async () => {
    installRecognition();
    const speech = installSynthesis();
    assistantApi.sendMessage.mockResolvedValue({
      message: 'The assistant reply.',
      action: { type: 'list', status: 'completed', tasks: [] },
    });

    const user = userEvent.setup();
    const { unmount } = render(<ChatPage />);
    await user.click(screen.getByRole('button', { name: /start voice conversation/i }));
    emitTranscript(window.SpeechRecognition.instances[0], 'Show my tasks');
    await screen.findByText('The assistant reply.');
    expect(speech.synthesis.speak).toHaveBeenCalledOnce();
    speech.fail();
    expect(await screen.findByText(/speech playback failed/i)).toBeInTheDocument();
    expect(screen.getByText('Stopped', { selector: '.chat-voice-state' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /speak response aloud/i }));
    unmount();
    expect(speech.synthesis.cancel).toHaveBeenCalled();
  });
});
