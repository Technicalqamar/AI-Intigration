import { Task } from '../models/task.model.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * @desc    Create a new task
 * @route   POST /api/tasks
 * @access  Public
 */
export const createTask = asyncHandler(async (req, res) => {
  const { title, description, status, dueDate } = req.body;

  const task = await Task.create({
    ...(req.assistantIdentity ? { ownerId: req.assistantIdentity.userId } : {}),
    title,
    description: description || '',
    status: status || 'pending',
    dueDate: dueDate || null,
  });

  return res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: task,
  });
});

/**
 * @desc    Retrieve all tasks
 * @route   GET /api/tasks
 * @access  Public
 */
export const getAllTasks = asyncHandler(async (req, res) => {
  const filter = req.assistantIdentity
    ? { ownerId: req.assistantIdentity.userId }
    : {};
  const tasks = await Task.find(filter).sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    message: 'Tasks retrieved successfully',
    data: tasks,
  });
});

/**
 * @desc    Retrieve a single task by ID
 * @route   GET /api/tasks/:id
 * @access  Public
 */
export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const filter = req.assistantIdentity
    ? { _id: id, ownerId: req.assistantIdentity.userId }
    : { _id: id };
  const task = await Task.findOne(filter);

  if (!task) {
    throw ApiError.notFound(`Task with ID '${id}' not found.`);
  }

  return res.status(200).json({
    success: true,
    message: 'Task retrieved successfully',
    data: task,
  });
});

/**
 * @desc    Update an existing task by ID
 * @route   PUT /api/tasks/:id
 * @access  Public
 */
export const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, status, dueDate } = req.body;

  // Filter only allowed fields to prevent arbitrary field injection
  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (dueDate !== undefined) updateData.dueDate = dueDate;

  const filter = req.assistantIdentity
    ? { _id: id, ownerId: req.assistantIdentity.userId }
    : { _id: id };
  const updatedTask = await Task.findOneAndUpdate(
    filter,
    updateData,
    {
      returnDocument: 'after',
      runValidators: true,
    }
  );

  if (!updatedTask) {
    throw ApiError.notFound(`Task with ID '${id}' not found.`);
  }

  return res.status(200).json({
    success: true,
    message: 'Task updated successfully',
    data: updatedTask,
  });
});

/**
 * @desc    Delete a task by ID
 * @route   DELETE /api/tasks/:id
 * @access  Public
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const filter = req.assistantIdentity
    ? { _id: id, ownerId: req.assistantIdentity.userId }
    : { _id: id };
  const deletedTask = await Task.findOneAndDelete(filter);

  if (!deletedTask) {
    throw ApiError.notFound(`Task with ID '${id}' not found.`);
  }

  return res.status(200).json({
    success: true,
    message: 'Task deleted successfully',
    data: {
      id: deletedTask._id,
      title: deletedTask.title,
    },
  });
});
