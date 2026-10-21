import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  LoaderCircle,
  Mic,
  MicOff,
  Plus,
  Send,
  ShieldCheck,
  Volume2,
  VolumeX,
  UserRound,
  X,
} from 'lucide-react';
import { assistantApi, taskApi } from '../api.js';
import { PageHeading, StatusBadge, formatDate } from '../components/ui.jsx';

const modes = [
  { id: 'task', label: 'Task assistant', description: 'Manage and review saved tasks' },
  { id: 'plan', label: 'Plan a task', description: 'Turn a task into clear steps' },
  { id: 'answer', label: 'Ask AI', description: 'Get an answer or a useful draft' },
];

const recognitionConstructor = () =>
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

const speechSynthesisApi = () =>
  typeof window !== 'undefined' && window.speechSynthesis;

const speechUtteranceConstructor = () =>
  typeof window !== 'undefined' && window.SpeechSynthesisUtterance;

const assistantSpeechText = (message) => {
  if (message.mode === 'answer') return message.data;
  if (message.mode === 'plan') {
    const plan = message.data;
    return `${plan.summary}. ${plan.steps.map((step, index) => `Step ${index + 1}: ${step}`).join('. ')}`;
  }
  return message.data?.assistant?.message ?? message.data?.message ?? '';
};

const MAX_SPOKEN_CHARACTERS = 4000;

function assistantErrorMessage(error) {
  if (error?.status === 401 || error?.status === 403) {
    return `You’re not authorized to use the assistant. ${error.message}`;
  }
  if (error?.status === 429 && error.message === 'Too many AI requests from this IP. Please try again later.') {
    return `The app’s AI request limit for this IP has been reached. Wait for the rate-limit window to reset before trying again. ${error.message}`;
  }
  if (error?.status === 429 && error.message === 'AI service rate limit reached with provider. Please try again shortly.') {
    return `The AI provider is rate-limiting requests. Wait before retrying, and check your provider quota if this continues. ${error.message}`;
  }
  if (error?.status === 404) {
    return `The task assistant is disabled or unavailable on this backend. For local development only, set AI_ASSISTANT_DEV_IDENTITY_ENABLED=true and configure AI_ASSISTANT_DEV_USER_ID in backend/.env, then restart the backend. The assistant only accesses tasks owned by that identity; never enable the development identity in production. ${error.message}`;
  }
  if (error?.status === 502 || error?.status === 503) {
    return `The assistant service is unavailable or could not complete the request. ${error.message}`;
  }
  return error?.message || 'Something went wrong. Please try again.';
}

function TaskResults({ action }) {
  const tasks = action.tasks || action.candidates || [];
  return (
    <div className="chat-action-result">
      {action.type === 'count' && action.counts && (
        <dl className="chat-counts">
          {[
            ['Total', action.counts.total],
            ['Pending', action.counts.pending],
            ['In progress', action.counts.inProgress],
            ['Completed', action.counts.completed],
            ['Overdue', action.counts.overdue],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      {action.type === 'report' && (
        <p className="chat-report-summary">{action.total} total · {action.overdue} overdue</p>
      )}
      {action.type === 'delete' && action.status === 'confirmation_required' && action.confirmation && (
        <div className="chat-confirmation">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>Confirm deleting <strong>{action.confirmation.task.title}</strong>. Nothing has been deleted yet.</span>
        </div>
      )}
      {tasks.length > 0 && (
        <ul className="chat-task-list" aria-label="Tasks returned by the assistant">
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong>
              {task.status && <StatusBadge status={task.status} />}
              {task.dueDate && <span className="chat-task-date">Due {formatDate(task.dueDate)}</span>}
              {task.description && <p>{task.description}</p>}
            </li>
          ))}
        </ul>
      )}
      {action.type === 'create' && action.status === 'completed' && action.task && (
        <p className="chat-action-status"><Check size={14} aria-hidden="true" /> Task created: {action.task.title}</p>
      )}
      {action.type === 'update' && action.status === 'completed' && action.task && (
        <p className="chat-action-status"><Check size={14} aria-hidden="true" /> Task updated: {action.task.title}</p>
      )}
      {action.type === 'delete' && action.status === 'completed' && action.task && (
        <p className="chat-action-status"><Check size={14} aria-hidden="true" /> Task deleted: {action.task.title}</p>
      )}
      {['create', 'update', 'delete'].includes(action.type) && action.status === 'not_performed' && (
        <p className="chat-action-not-performed">No task changes were made.</p>
      )}
    </div>
  );
}

function AssistantReply({
  message,
  onConfirmDelete,
  onCancelDelete,
  onRetryConfirmation,
  onSpeak,
  speaking,
  synthesisSupported,
  busy,
}) {
  if (message.pending) {
    return (
      <div className="chat-pending" role="status">
        <LoaderCircle size={16} className="spin" aria-hidden="true" />
        <span>Thinking…</span>
      </div>
    );
  }
  if (message.error) {
    return (
      <div className="chat-error" role="alert">
        <p>{message.error}</p>
        <button className="button button-secondary button-small" type="button" onClick={() => message.onRetry?.()} disabled={busy}>
          Try again
        </button>
      </div>
    );
  }

  const speechText = assistantSpeechText(message);
  const canSpeak = typeof speechText === 'string' && speechText.trim().length > 0;

  if (message.mode === 'answer') {
    return (
      <>
        <p className="chat-reply-text">{message.data}</p>
        <SpeechControls
          canSpeak={canSpeak}
          synthesisSupported={synthesisSupported}
          speaking={speaking}
          onSpeak={() => onSpeak(message.id, speechText)}
        />
      </>
    );
  }
  if (message.mode === 'plan') {
    const plan = message.data;
    return (
      <>
        <div className="chat-plan">
          <div className="chat-plan-heading"><strong>{plan.summary}</strong><span>{plan.priority} priority · {plan.estimatedHours} {plan.estimatedHours === 1 ? 'hour' : 'hours'}</span></div>
          <ol>{plan.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
        </div>
        <SpeechControls
          canSpeak={canSpeak}
          synthesisSupported={synthesisSupported}
          speaking={speaking}
          onSpeak={() => onSpeak(message.id, speechText)}
        />
      </>
    );
  }

  const assistant = message.data?.assistant ?? message.data;
  const action = assistant?.action;
  const confirmation = action?.confirmation;
  return (
    <>
      <p className="chat-reply-text">{assistant.message}</p>
      {action && <TaskResults action={action} />}
      <SpeechControls
        canSpeak={canSpeak}
        synthesisSupported={synthesisSupported}
        speaking={speaking}
        onSpeak={() => onSpeak(message.id, speechText)}
      />
      {action?.status === 'confirmation_required' && confirmation?.token && !message.cancelled && (
        <div className="chat-confirmation-actions">
          <button className="button button-danger" type="button" onClick={() => onConfirmDelete(message.id, confirmation.token)} disabled={busy || message.confirming}>
            {message.confirming ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
            {message.confirming ? 'Confirming…' : 'Confirm deletion'}
          </button>
          <button className="button button-secondary" type="button" onClick={() => onCancelDelete(message.id)} disabled={busy || message.confirming}>
            Cancel
          </button>
        </div>
      )}
      {message.cancelled && <p className="chat-action-not-performed">Deletion cancelled. No task was deleted.</p>}
      {message.confirmationError && (
        <div className="chat-error" role="alert">
          <p>{message.confirmationError}</p>
          <button className="button button-secondary button-small" type="button" onClick={() => onRetryConfirmation(message.id, confirmation.token)} disabled={busy}>
            Retry confirmation
          </button>
        </div>
      )}
    </>
  );
}

function SpeechControls({ canSpeak, synthesisSupported, speaking, onSpeak }) {
  if (!synthesisSupported || !canSpeak) return null;
  return (
    <div className="chat-speech-controls">
      <button
        className="chat-speak-button"
        type="button"
        aria-label={speaking ? 'Stop speaking response' : 'Speak response aloud'}
        onClick={onSpeak}
      >
        {speaking ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
        {speaking ? 'Stop speaking' : 'Speak'}
      </button>
    </div>
  );
}

export default function ChatPage() {
  const [mode, setMode] = useState('task');
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const [synthesisSupported, setSynthesisSupported] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceState, setVoiceState] = useState('stopped');
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [recognitionError, setRecognitionError] = useState('');
  const messagesEndRef = useRef(null);
  const conversationRef = useRef(null);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const speakingMessageRef = useRef(null);
  const voiceActiveRef = useRef(false);
  const autoSpeakRef = useRef(false);
  const autoSpeakBeforeVoiceRef = useRef(false);
  const recognitionTurnRef = useRef(0);
  const speechResumeRef = useRef(false);
  const startRecognitionRef = useRef(null);
  const originalDraftRef = useRef('');
  const atBottomRef = useRef(true);
  const busyRef = useRef(false);
  const messageCounterRef = useRef(0);
  const nextMessageId = () => `chat-${Date.now()}-${messageCounterRef.current++}`;

  useEffect(() => {
    setSpeechSupported(Boolean(recognitionConstructor()));
    setSynthesisSupported(Boolean(speechSynthesisApi() && speechUtteranceConstructor()));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      voiceActiveRef.current = false;
      speechResumeRef.current = false;
      utteranceRef.current = null;
      speechSynthesisApi()?.cancel();
    };
  }, []);

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  useEffect(() => {
    if (atBottomRef.current && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  const onConversationScroll = () => {
    const element = conversationRef.current;
    if (element) atBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
  };

  const updateMessage = (id, update) => {
    setMessages((current) => current.map((message) =>
      message.id === id ? { ...message, ...update } : message
    ));
  };

  const endVoiceMode = () => {
    voiceActiveRef.current = false;
    setListening(false);
    setVoiceState('stopped');
    setAutoSpeak(autoSpeakBeforeVoiceRef.current);
    autoSpeakRef.current = autoSpeakBeforeVoiceRef.current;
  };

  const stopSpeaking = ({ resumeVoice = false } = {}) => {
    speechResumeRef.current = false;
    utteranceRef.current = null;
    speakingMessageRef.current = null;
    speechSynthesisApi()?.cancel();
    setSpeakingMessageId(null);
    if (resumeVoice && voiceActiveRef.current) {
      setVoiceState('listening');
      startRecognitionRef.current?.();
    }
  };

  const speak = (messageId, text, { resumeVoice = false } = {}) => {
    const synthesis = speechSynthesisApi();
    const Utterance = speechUtteranceConstructor();
    const spokenText = typeof text === 'string' ? text.trim() : '';
    if (!synthesis || !Utterance) {
      setSpeechError('Speech synthesis is not supported in this browser. You can still read and type messages.');
      setSynthesisSupported(false);
      return false;
    }
    if (!spokenText) {
      setSpeechError('There is no response text available to speak.');
      return false;
    }
    if (speakingMessageRef.current === messageId && utteranceRef.current) {
      stopSpeaking();
      if (resumeVoice && voiceActiveRef.current) {
        setVoiceState('listening');
        startRecognitionRef.current?.();
      }
      return false;
    }

    speechResumeRef.current = false;
    utteranceRef.current = null;
    speakingMessageRef.current = null;
    setSpeakingMessageId(null);
    synthesis.cancel();
    const clipped = spokenText.length > MAX_SPOKEN_CHARACTERS;
    const utterance = new Utterance(spokenText.slice(0, MAX_SPOKEN_CHARACTERS));
    utteranceRef.current = utterance;
    speakingMessageRef.current = messageId;
    speechResumeRef.current = resumeVoice;
    setSpeakingMessageId(messageId);
    setSpeechError(clipped
      ? 'This response is long; speech playback will read the first 4,000 characters.'
      : '');
    if (voiceActiveRef.current) setVoiceState('speaking');
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      const shouldResume = speechResumeRef.current && voiceActiveRef.current;
      utteranceRef.current = null;
      speakingMessageRef.current = null;
      speechResumeRef.current = false;
      setSpeakingMessageId(null);
      if (shouldResume) {
        setVoiceState('listening');
        startRecognitionRef.current?.();
      }
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      speakingMessageRef.current = null;
      speechResumeRef.current = false;
      setSpeakingMessageId(null);
      setSpeechError('Speech playback failed. You can still read the response.');
      if (voiceActiveRef.current) {
        endVoiceMode();
      }
    };
    try {
      synthesis.speak(utterance);
      return true;
    } catch {
      utteranceRef.current = null;
      speakingMessageRef.current = null;
      speechResumeRef.current = false;
      setSpeakingMessageId(null);
      setSpeechError('Could not start speech playback. You can still read the response.');
      if (voiceActiveRef.current) {
        endVoiceMode();
      }
      return false;
    }
  };

  const runRequest = async ({ text, requestMode, existingMessageId, voiceTurn = false }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const assistantMessageId = existingMessageId || nextMessageId();
    atBottomRef.current = true;

    if (existingMessageId) {
      updateMessage(existingMessageId, { pending: true, error: '', onRetry: undefined });
    } else {
      const userMessageId = nextMessageId();
      setMessages((current) => [
        ...current,
        { id: userMessageId, role: 'user', text, mode: requestMode },
        { id: assistantMessageId, role: 'assistant', pending: true, mode: requestMode },
      ]);
    }

    try {
      let result;
      if (requestMode === 'task') {
        result = { mode: 'task', assistant: await assistantApi.sendMessage(text) };
      } else if (requestMode === 'plan') {
        result = { mode: 'plan', plan: await taskApi.planTask({ description: text }) };
      } else {
        result = { mode: 'answer', answer: await taskApi.answerPrompt(text) };
      }
      updateMessage(assistantMessageId, {
        pending: false,
        error: '',
        data: requestMode === 'task' ? result.assistant : result[requestMode],
        mode: requestMode,
      });
      const responseText = requestMode === 'task'
        ? result.assistant.message
        : requestMode === 'plan'
          ? assistantSpeechText({ mode: 'plan', data: result.plan })
          : result.answer;
      if (autoSpeakRef.current || (voiceActiveRef.current && voiceTurn)) {
        if (voiceActiveRef.current) setVoiceState('processing');
        if (!autoSpeakRef.current) {
          setVoiceState('listening');
          startRecognitionRef.current?.();
        } else if (!speak(assistantMessageId, responseText, { resumeVoice: voiceActiveRef.current })) {
          if (voiceActiveRef.current) {
            endVoiceMode();
          }
        }
      }
    } catch (error) {
      const message = assistantErrorMessage(error);
      updateMessage(assistantMessageId, {
        pending: false,
        error: message,
        onRetry: () => runRequest({ text, requestMode, existingMessageId: assistantMessageId }),
      });
      if (voiceActiveRef.current) {
        endVoiceMode();
        setSpeechError('Voice conversation stopped because the assistant request failed.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const stopRecognition = (cancel = false) => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognitionTurnRef.current += 1;
    if (cancel) {
      recognition.abort();
      setComposer(originalDraftRef.current);
      setSpeechError('');
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    recognition.stop();
    if (recognitionRef.current === recognition) recognitionRef.current = null;
    setListening(false);
  };

  const startRecognition = ({ voiceTurn = false } = {}) => {
    if (recognitionRef.current) return;
    const SpeechRecognition = recognitionConstructor();
    if (!SpeechRecognition) {
      setSpeechError('Speech input is not supported in this browser. You can still type your message.');
      if (voiceTurn) {
        endVoiceMode();
      }
      return;
    }
    if (speechSynthesisApi()?.speaking || utteranceRef.current) stopSpeaking();
    setSpeechError('');
    setRecognitionError('');
    originalDraftRef.current = composer;
    let recognition;
    try {
      recognition = new SpeechRecognition();
    } catch {
      setSpeechError('Could not start speech recognition. Check your browser and microphone settings.');
      if (voiceTurn) {
        endVoiceMode();
      }
      return;
    }
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = document.documentElement.lang || 'en-US';
    const recognitionTurn = ++recognitionTurnRef.current;
    let submittedThisTurn = false;
    let handledResult = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (transcript) {
        if (handledResult || recognitionTurn !== recognitionTurnRef.current) return;
        handledResult = true;
        setSpeechError('');
        if (!voiceTurn) {
          setComposer((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${transcript}`);
        }
        if (voiceTurn && !submittedThisTurn && recognitionTurn === recognitionTurnRef.current && voiceActiveRef.current) {
          if (busyRef.current) {
            setSpeechError('The assistant is already processing a request. Voice mode has stopped.');
            endVoiceMode();
            return;
          }
          submittedThisTurn = true;
          setListening(false);
          setVoiceState('processing');
          runRequest({ text: transcript, requestMode: mode, voiceTurn: true });
        }
      } else if (voiceTurn && !submittedThisTurn) {
        setSpeechError('No speech was recognized. Try speaking again or type your message.');
      }
    };
    recognition.onerror = (event) => {
      const messagesByError = {
        'not-allowed': 'Microphone permission was denied. Allow microphone access in your browser settings and try again.',
        'service-not-allowed': 'Speech recognition is blocked by your browser. Check microphone and site permissions.',
        'audio-capture': 'No microphone is available. Connect or enable a microphone, or type your message.',
        'no-speech': 'No speech was detected. Try again or type your message.',
        network: 'Speech recognition could not connect. Check your connection and try again.',
      };
      setSpeechError(messagesByError[event.error] || 'Speech recognition failed. You can try again or type your message.');
      setListening(false);
      recognitionRef.current = null;
      if (voiceTurn) {
        endVoiceMode();
      }
    };
    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (voiceTurn && voiceActiveRef.current && !submittedThisTurn && recognitionTurn === recognitionTurnRef.current) {
        setSpeechError('No speech was detected. Start voice conversation again when you are ready.');
        endVoiceMode();
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      if (voiceTurn) setVoiceState('listening');
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setSpeechError('Could not start speech recognition. Check your microphone permissions and try again.');
      if (voiceTurn) {
        endVoiceMode();
      }
    }
  };

  startRecognitionRef.current = () => startRecognition({ voiceTurn: true });

  const startVoiceConversation = () => {
    if (!recognitionConstructor()) {
      setSpeechError('Voice conversation is unavailable because this browser does not support speech recognition. Typed chat still works.');
      return;
    }
    if (voiceActiveRef.current) return;
    if (recognitionRef.current) stopRecognition(true);
    stopSpeaking();
    setSpeechError('');
    setRecognitionError('');
    autoSpeakBeforeVoiceRef.current = autoSpeakRef.current;
    voiceActiveRef.current = true;
    setAutoSpeak(true);
    autoSpeakRef.current = true;
    setVoiceState('listening');
    startRecognition({ voiceTurn: true });
  };

  const stopVoiceConversation = () => {
    speechResumeRef.current = false;
    recognitionTurnRef.current += 1;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    endVoiceMode();
    stopSpeaking();
  };

  const onSpeak = (messageId, text) => {
    if (speakingMessageRef.current === messageId) {
      stopSpeaking({ resumeVoice: voiceActiveRef.current });
      return;
    }
    if (recognitionRef.current) stopRecognition(true);
    speak(messageId, text, { resumeVoice: voiceActiveRef.current });
  };

  const send = (event) => {
    event.preventDefault();
    const text = composer.trim();
    const maxLength = mode === 'plan' ? 150 : 3000;
    if (!text || busyRef.current || text.length > maxLength) return;
    if (recognitionRef.current) stopRecognition();
    if (utteranceRef.current) stopSpeaking();
    setComposer('');
    setSpeechError('');
    setRecognitionError('');
    runRequest({ text, requestMode: mode });
  };

  const confirmDelete = async (messageId, confirmationToken) => {
    if (busyRef.current) return;
    const resumeVoice = voiceActiveRef.current;
    if (recognitionRef.current) stopRecognition(true);
    busyRef.current = true;
    setBusy(true);
    if (resumeVoice) setVoiceState('processing');
    updateMessage(messageId, { confirming: true, confirmationError: '' });
    atBottomRef.current = true;
    try {
      const assistant = await assistantApi.confirmDelete(confirmationToken);
      updateMessage(messageId, {
        confirming: false,
        cancelled: false,
        data: { assistant },
      });
      if (autoSpeakRef.current) {
        speak(messageId, assistant.message, { resumeVoice: voiceActiveRef.current });
      } else if (voiceActiveRef.current) {
        setVoiceState('listening');
        startRecognitionRef.current?.();
      }
    } catch (error) {
      updateMessage(messageId, {
        confirming: false,
        confirmationError: assistantErrorMessage(error),
      });
      if (voiceActiveRef.current) {
        endVoiceMode();
        setSpeechError('Voice conversation stopped because deletion confirmation failed.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const clearConversation = () => {
    if (busyRef.current) return;
    if (voiceActiveRef.current) stopVoiceConversation();
    if (recognitionRef.current) stopRecognition(true);
    stopSpeaking();
    setMessages([]);
    setComposer('');
    setSpeechError('');
    setRecognitionError('');
    atBottomRef.current = true;
  };

  const toggleAutoSpeak = (event) => {
    const enabled = event.target.checked;
    setAutoSpeak(enabled);
    autoSpeakRef.current = enabled;
    if (voiceActiveRef.current) autoSpeakBeforeVoiceRef.current = enabled;
    if (!enabled && utteranceRef.current) {
      stopSpeaking({ resumeVoice: voiceActiveRef.current });
    }
  };

  const voiceStateLabel = {
    stopped: 'Stopped',
    listening: 'Listening',
    processing: 'Processing',
    speaking: 'Speaking',
  }[voiceState];

  const modeMaxLength = mode === 'plan' ? 150 : 3000;

  return (
    <div className="chat-page">
      <PageHeading
        eyebrow="TASKFLOW AI"
        title="Your AI workspace."
        description="Manage saved tasks, plan your next step, or ask a question."
        action={(
          <button className="button button-secondary" type="button" onClick={clearConversation} disabled={busy}>
            <Plus size={16} aria-hidden="true" /> New chat
          </button>
        )}
      />

      <div className="chat-mode-switch" role="tablist" aria-label="Choose an assistant mode">
        {modes.map(({ id, label }) => (
          <button
            className={`chat-mode-tab${mode === id ? ' chat-mode-tab-active' : ''}`}
            id={`chat-mode-${id}`}
            type="button"
            role="tab"
            aria-selected={mode === id}
            key={id}
            onClick={() => setMode(id)}
            disabled={busy || voiceState !== 'stopped'}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="chat-panel" aria-label="AI chat">
        <div className="chat-context"><span className="chat-online-dot" />{modes.find((item) => item.id === mode)?.description}<span className="chat-session-note">This conversation is only kept in this page session.</span></div>
        <div className="chat-voice-toolbar">
          <div className="chat-voice-settings">
            <label className="chat-auto-speak">
              <input type="checkbox" checked={autoSpeak} onChange={toggleAutoSpeak} aria-label="Automatically speak assistant replies" />
              <span>Speak replies automatically</span>
            </label>
            <span className="chat-voice-support">
              {!speechSupported && 'Speech recognition is unavailable.'}
              {!synthesisSupported && 'Speech synthesis is unavailable.'}
              {speechSupported && synthesisSupported && 'Turn-by-turn browser voice, not live streaming.'}
            </span>
          </div>
          <div className="chat-voice-actions">
            <span className={`chat-voice-state chat-voice-state-${voiceState}`} role="status" aria-live="polite">
              <span className="chat-voice-state-dot" /> {voiceStateLabel}
            </span>
            {speakingMessageId && (
              <button className="button button-secondary button-small" type="button" onClick={() => stopSpeaking({ resumeVoice: voiceActiveRef.current })}>
                <VolumeX size={14} aria-hidden="true" /> Stop speaking
              </button>
            )}
            {voiceState !== 'stopped' ? (
              <button className="button button-secondary button-small" type="button" onClick={stopVoiceConversation} aria-label="Stop voice conversation">
                <MicOff size={14} aria-hidden="true" /> Stop voice mode
              </button>
            ) : (
              <button className="button button-secondary button-small" type="button" onClick={startVoiceConversation} disabled={!speechSupported} aria-label="Start voice conversation">
                <Mic size={14} aria-hidden="true" /> Voice conversation
              </button>
            )}
          </div>
        </div>
        <div className="chat-conversation" ref={conversationRef} onScroll={onConversationScroll} aria-live="polite">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <span className="chat-welcome-icon"><Bot size={23} aria-hidden="true" /></span>
              <h2>What can I help you with?</h2>
              <p>{mode === 'task'
                ? 'Ask about your tasks, request a report, or clearly ask me to create, update, or delete a task.'
                : mode === 'plan'
                  ? 'Describe a task in 150 characters or fewer and I’ll break it into practical steps.'
                  : 'Ask a question or request a useful first draft.'}</p>
            </div>
          ) : messages.map((message) => (
            <article className={`chat-message chat-message-${message.role}`} key={message.id}>
              <span className="chat-message-avatar" aria-hidden="true">
                {message.role === 'assistant' ? <Bot size={16} /> : <UserRound size={15} />}
              </span>
              <div className="chat-message-body">
                <div className="chat-message-label">{message.role === 'assistant' ? 'Taskflow AI' : 'You'}</div>
                {message.role === 'user'
                  ? <p className="chat-user-text">{message.text}</p>
                  : (
                    <AssistantReply
                      message={message}
                      onConfirmDelete={confirmDelete}
                      onCancelDelete={(id) => updateMessage(id, { cancelled: true })}
                      onRetryConfirmation={confirmDelete}
                      onSpeak={onSpeak}
                      speaking={speakingMessageId === message.id}
                      synthesisSupported={synthesisSupported}
                      busy={busy}
                    />
                  )}
              </div>
            </article>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-composer" onSubmit={send}>
          <label className="sr-only" htmlFor="chat-message">Message the AI assistant</label>
          <textarea
            id="chat-message"
            value={composer}
            maxLength={modeMaxLength}
            rows={2}
            placeholder={mode === 'task' ? 'Message Taskflow AI…' : mode === 'plan' ? 'Describe a task to plan…' : 'Ask a question…'}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form.requestSubmit();
              }
            }}
            disabled={busy || voiceState !== 'stopped'}
            aria-describedby="chat-input-hint chat-input-count"
          />
          <div className="chat-composer-bottom">
            <div className="chat-composer-tools">
              {speechSupported && voiceState === 'stopped' ? (
                <>
                  <button className={`icon-button chat-mic-button${listening ? ' chat-mic-listening' : ''}`} type="button" onClick={() => listening ? stopRecognition() : startRecognition()} disabled={busy} aria-label={listening ? 'Stop listening' : 'Start speech input'} title={listening ? 'Stop listening' : 'Start speech input'}>
                    {listening ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
                  </button>
                  {listening && <button className="chat-cancel-recording" type="button" onClick={() => stopRecognition(true)}><X size={13} aria-hidden="true" /> Cancel recording</button>}
                </>
              ) : !speechSupported ? (
                <span className="chat-speech-unavailable">Speech input isn’t supported here. You can still type.</span>
              ) : (
                <span className="chat-speech-unavailable">Voice mode controls listening above.</span>
              )}
              <span id="chat-input-hint" className="chat-keyboard-hint">Enter to send · Shift+Enter for a new line</span>
            </div>
            <span id="chat-input-count" className="chat-character-count">{composer.length} / {modeMaxLength}</span>
            <button className="button button-primary chat-send-button" type="submit" disabled={busy || voiceState !== 'stopped' || !composer.trim() || composer.trim().length > modeMaxLength} aria-label="Send message">
              {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              <span>{busy ? 'Working…' : 'Send'}</span>
            </button>
          </div>
          {(speechError || recognitionError) && <p className="chat-speech-error" role="alert">{speechError || recognitionError}</p>}
          {listening && <p className="chat-listening-status" role="status"><span className="chat-recording-dot" /> Listening… Speak now. {voiceState === 'stopped' ? 'Speech will appear in the composer for review; it will not be sent automatically.' : 'Voice mode sends one recognized utterance through the selected assistant mode.'}</p>}
          {voiceState !== 'stopped' && (
            <p className="chat-voice-status" role="status">
              {voiceState === 'listening' && 'Voice mode is listening for one utterance. Stop voice mode at any time.'}
              {voiceState === 'processing' && 'Your recognized speech is being sent through the current assistant mode.'}
              {voiceState === 'speaking' && 'The assistant is speaking. Listening resumes after playback finishes.'}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
