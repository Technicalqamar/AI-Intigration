import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getAllTasks,
  getTaskById,
  updateTask,
} from '../controllers/task.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createTaskSchema,
  taskIdParamSchema,
  updateTaskSchema,
} from '../validators/task.validator.js';

const router = Router();

router
  .route('/')
  .get(getAllTasks)
  .post(validate(createTaskSchema, 'body'), createTask);

router
  .route('/:id')
  .get(validate(taskIdParamSchema, 'params'), getTaskById)
  .put(
    validate(taskIdParamSchema, 'params'),
    validate(updateTaskSchema, 'body'),
    updateTask
  )
  .delete(validate(taskIdParamSchema, 'params'), deleteTask);

export default router;
