const { query } = require("../config/db");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const ai = require("../services/aiService");
const { emitToBoard, logActivity } = require("../realtime");

const generateTasks = asyncHandler(async (req, res) => {
  const goal = (req.body.goal || "").trim();

  if (!goal) throw ApiError.badRequest("A project goal is required");

  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 6, 1), 15);

  const suggestions = await ai.generateTasks(goal, count);

  if (!req.body.column_id) {
    return res.json({
      tasks: suggestions,
      persisted: false,
    });
  }

  const colRes = await query(
    "SELECT id FROM columns WHERE id = $1 AND board_id = $2",
    [req.body.column_id, req.board.id],
  );

  if (!colRes.rows.length)
    throw ApiError.badRequest("column_id does not belong to this board");

  const baseRes = await query(
    "SELECT COALESCE(MAX(position), 0) AS pos FROM tasks WHERE column_id = $1",
    [req.body.column_id],
  );

  let pos = Number(baseRes.rows[0].pos);
  const created = [];

  for (const s of suggestions) {
    pos += 1000;

    const { rows } = await query(
      `INSERT INTO tasks (
        board_id,
        column_id,
        title,
        description,
        priority,
        position,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        req.board.id,
        req.body.column_id,
        s.title,
        s.description,
        s.priority,
        pos,
        req.user.id,
      ],
    );

    created.push(rows[0]);
    emitToBoard(req.board.id, "task:created", rows[0]);
  }

  await logActivity({
    boardId: req.board.id,
    userId: req.user.id,
    action: "ai.generated_tasks",
    message: `${req.user.name} generated ${created.length} tasks with AI`,
    metadata: { goal, count: created.length },
  });

  res.status(201).json({ tasks: created, persisted: true });
});

const breakdownTask = asyncHandler(async (req, res) => {
  let { title, description } = req.body;
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 5, 1), 12);

  if (req.body.taskId) {
    const { rows } = await query(
      "SELECT title, description FROM tasks WHERE id = $1 AND board_id = $2",
      [req.body.taskId, req.board.id],
    );

    if (!rows.length) throw ApiError.notFound("Task not found");

    title = rows[0].title;
    description = rows[0].description;
  }

  if (!title) throw ApiError.badRequest("A task title (or taskId) is required");

  const subtasks = await ai.breakdownTask(title, description, count);

  res.json({ subtasks });
});

const summarizeBoard = asyncHandler(async (req, res) => {
  const [boardRes, colsRes, tasksRes] = await Promise.all([
    query("SELECT title FROM boards WHERE id = $1", [req.board.id]),
    query(
      "SELECT id, title FROM columns WHERE board_id = $1 ORDER BY position ASC",
      [req.board.id],
    ),
    query("SELECT column_id, title, priority FROM tasks WHERE board_id = $1", [
      req.board.id,
    ]),
  ]);

  const columns = colsRes.rows.map((c) => ({
    title: c.title,
    tasks: tasksRes.rows.filter((t) => t.column_id === c.id),
  }));

  const summary = await ai.summarizeBoard({
    boardTitle: boardRes.rows[0]?.title || "Board",
    columns,
  });

  res.json({ summary });
});

module.exports = { generateTasks, breakdownTask, summarizeBoard };
