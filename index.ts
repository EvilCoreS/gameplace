import express from "express";
import * as http from "http";
import { Server } from "socket.io";
import { Chess } from "chess.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const players: { id: string; nickname: string }[] = [];
const games: { [key: string]: Chess } = {};

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", (socket) => {
  socket.on("move", (args: { [key: string]: any }) => {
    const { from, to } = args.move;
    games[args.roomName].move({ from, to, promotion: "q" });
    io.to(args.roomName).emit("move", args.move);

    if (games[args.roomName].isGameOver()) {
      io.to(args.roomName).emit("game-end");
    }
  });

  socket.on("leaveRoom", (args) => {
    socket.leave(args);
  });

  socket.on("update-nick", (args) => {
    const index = players.findIndex((player) => player.id === socket.id);
    if (index >= 0) players[index].nickname = args;
    else players.push({ id: socket.id, nickname: args });
    io.emit("update-list", players);
  });

  /* socket.on("join-room", (args) => {
    const roomName = args.from.id + "-" + args.to.id;
    socket.join(roomName);
  });

  socket.on("signal-to-join", (args) => {
    io.to([args.from.id, args.to.id]).emit("join-room", args);
    setTimeout(() => {
      socket.emit("preload-match", args);
    }, 1000);
  });
*/
  socket.on("challenge", (args) => {
    socket.join(args.from.id + "-" + args.to.id);
    io.to(args.to.id).emit("show-challenge", args);
  });

  socket.on("decline-match", (args) => {
    io.to(args.from.id).emit("match-declined", args.from.id + "-" + args.to.id);
  });

  socket.on("preload-match", (args) => {
    const roomName = args.from.id + "-" + args.to.id;

    const tempFen =
      "rnbqkbnr/ppppp2p/5p2/6p1/4P3/2P5/PP1P1PPP/RNBQKBNR w KQkq g6 0 3";
    games[roomName] = new Chess(tempFen);
    socket.join(roomName);
    if (Math.random() >= 0.5) {
      io.to(args.from.id).emit("team-selection", "w");
      io.to(args.to.id).emit("team-selection", "b");
    } else {
      io.to(args.from.id).emit("team-selection", "b");
      io.to(args.to.id).emit("team-selection", "w");
    }
    io.to(roomName).emit("board-load", games[roomName].fen());
    io.to(roomName).emit("start-match", args);
  });

  socket.on("start-emote", (args: { [key: string]: any }) => {
    io.to(args.room).emit("start-emote", args.emote);
  });

  socket.on("disconnect", () => {
    const index = players.findIndex((players) => socket.id === players.id);
    players.splice(index, 1);
    io.emit("update-list", players);
  });
});

server.listen(3000, () => {
  console.log("http://localhost:3000/");
});
