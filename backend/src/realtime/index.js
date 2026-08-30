    const { query } = require("../config/db");

let io = null;

const setIo = (instance) => {
  io = instance;
};

const boardRoom = (boardId) => `board:${boardId}`;

const emitToBoard = (boardId, event, payload) => {
  if (io) io.to(boardRoom(boardId)).emit(event, payload);
};

const logActivity = async ({ boardId, userId, action, message, metadata }) => {
  const { rows } = await query(
    `INSERT INTO activities (board_id, user_id, action, message, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, board_id, user_id, action, message, metadata, created_at`,
    [boardId, userId || null, action, message, metadata ? JSON.stringify(metadata) : null]
  );

  const activity = rows[0];
  emitToBoard(boardId, "activity:new", activity);
  return activity;
};

module.exports = { setIo, emitToBoard, logActivity, boardRoom };