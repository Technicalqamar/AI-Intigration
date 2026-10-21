import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      trim: true,
      select: false,
    },
    title: {
      type: String,
      required: [true, 'Task title is required.'],
      trim: true,
      maxlength: [150, 'Task title cannot exceed 150 characters.'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters.'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'in-progress', 'completed'],
        message: "Status must be either 'pending', 'in-progress', or 'completed'.",
      },
      default: 'pending',
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        delete ret.ownerId;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.__v;
        delete ret.ownerId;
        return ret;
      },
    },
  }
);

export const Task = mongoose.model('Task', taskSchema);

export default Task;
