> **BrainSync Context Pumper** 🧠
> Dynamically loaded for active file: `backend\src\services\attendanceService.ts` (Domain: **Backend (API/Server)**)

### 📐 Backend (API/Server) Conventions & Fixes
- **[problem-fix] Fixed null crash in SPADA**: - import { Request, Response } from 'express';
+ // SPADA Task Manager - Task Controller
- import prisma from '../config/database';
+ import { Request, Response } from 'express';
- 
+ import prisma from '../config/database';
- export const deleteTask = async (req: Request, res: Response) => {
+ 
-     const taskId = parseInt(req.params.id as string);
+ export const deleteTask = async (req: Request, res: Response) => {
- 
+     const taskId = parseInt(req.params.id as string);
-     if (isNaN(taskId)) {
+ 
-         res.status(400).json({ message: 'Invalid task ID' });
+     if (isNaN(taskId)) {
-         return;
+         res.status(400).json({ message: 'Invalid task ID' });
-     }
+         return;
- 
+     }
-     try {
+ 
-         // Soft delete the task
+     try {
-         const task = await prisma.task.update({
+         // Soft delete the task
-             where: { id: taskId },
+         const task = await prisma.task.update({
-             data: { isDeleted: true }
+             where: { id: taskId },
-         });
+             data: { isDeleted: true }
- 
+         });
-         res.status(200).json({ message: 'Task deleted successfully', data: task });
+ 
-     } catch (error) {
+         res.status(200).json({ message: 'Task deleted successfully', data: task });
-         console.error('Error deleting task:', error);
+     } catch (error) {
-         res.status(500).json({ message: 'Failed to delete task' });
+         console.error('Error deleting task:', error);
-     }
+         res.status(500).json({ message: 'Failed to delete task' });
- };
+     }
- 
+ };
- export const updateTaskDeadline = async (req: Request, res: Response) => {
+ 
-     const taskId = parseInt(req.params.id as string);
+ export const updateTaskDeadline = async (req: Request, res: Response) => {
-     const userId = (req as any).userId;
+     const taskId = parseInt(req.params.id as string);
-     const { customDeadline
… [diff truncated]

📌 IDE AST Context: Modified symbols likely include [deleteTask, updateTaskDeadline]
