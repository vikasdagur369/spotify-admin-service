import { Request } from "express";

import cloudinary from "cloudinary";
import { sql } from "./config/db.js";
import { redisClient } from "./index.js";
import { TryCatch } from "./tryCatch.js";
import getBuffer from "./config/datauri.js";

interface AuthencatedRequest extends Request {
  user?: {
    _id: string;
    role: string;
  };
}

export const addAlbum = TryCatch(async (req: AuthencatedRequest, res) => {
  if (req.user?.role !== "admin") {
    res.status(401).json({
      message: "You are not admin",
    });
    return;
  }

  const { title, description } = req.body;

  const file = req.file;

  if (!file) {
    res.status(400).json({
      message: "No file to upload",
    });
    return;
  }

  const fileBuffer = getBuffer(file);

  if (!fileBuffer || !fileBuffer.content) {
    res.status(500).json({
      message: "Failed to generate file buffer",
    });
    return;
  }

  const cloud = await cloudinary.v2.uploader.upload(fileBuffer.content, {
    folder: "albums",
  });

  const result = await sql`
   INSERT INTO albums (title, description, thumbnail) VALUES (${title}, ${description}, ${cloud.secure_url}) RETURNING *
  `;

  if (redisClient.isReady) {
    await redisClient.del("albums");
    console.log("Cache invalidated for albums");
  }

  res.json({
    message: "Album Created",
    album: result[0],
  });
});

export const addSong = TryCatch(async (req: AuthencatedRequest, res) => {
  if (req.user?.role !== "admin") {
    res.status(401).json({
      message: "You are not admin",
    });
    return;
  }

  const { title, description, album } = req.body;

  const isAlbum = await sql`SELECT * FROM albums WHERE id = ${album}`;

  if (isAlbum.length === 0) {
    res.status(404).json({
      message: "No album with this id",
    });
    return;
  }

  const file = req.file;

  if (!file) {
    res.status(400).json({
      message: "No file to upload",
    });
    return;
  }

  const fileBuffer = getBuffer(file);

  if (!fileBuffer || !fileBuffer.content) {
    res.status(500).json({
      message: "Failed to generate file buffer",
    });
    return;
  }

  const cloud = await cloudinary.v2.uploader.upload(fileBuffer.content, {
    folder: "songs",
    resource_type: "video",
  });

  const result = await sql`
    INSERT INTO songs (title, description, audio, album_id) VALUES
    (${title}, ${description}, ${cloud.secure_url}, ${album})
  `;

  if (redisClient.isReady) {
    await redisClient.del("songs");
    console.log("Cache invalidated for songs");
  }

  res.json({
    message: "Song Added",
  });
});

export const addThumbnail = TryCatch(async (req: AuthencatedRequest, res) => {
  if (req.user?.role !== "admin") {
    res.status(401).json({
      message: "You are not admin",
    });
    return;
  }

  const song = await sql`SELECT * FROM songs WHERE id = ${req.params.id}`;

  if (song.length === 0) {
    res.status(404).json({
      message: "No song with this id",
    });
    return;
  }

  const file = req.file;

  if (!file) {
    res.status(400).json({
      message: "No file to upload",
    });
    return;
  }

  const fileBuffer = getBuffer(file);

  if (!fileBuffer || !fileBuffer.content) {
    res.status(500).json({
      message: "Failed to generate file buffer",
    });
    return;
  }

  const cloud = await cloudinary.v2.uploader.upload(fileBuffer.content);

  const result = await sql`
    UPDATE songs SET thumbnail = ${cloud.secure_url} WHERE id = ${req.params.id} RETURNING *
  `;

  if (redisClient.isReady) {
    await redisClient.del("songs");
    console.log("Cache invalidated for songs");
  }

  res.json({
    message: "Thumbnail added",
    song: result[0],
  });
});

export const deleteAlbum = TryCatch(async (req: AuthencatedRequest, res) => {
  if (req.user?.role !== "admin") {
    res.status(401).json({
      message: "You are not admin",
    });
    return;
  }

  const { id } = req.params;

  const isAlbum = await sql`SELECT * FROM albums WHERE id = ${id}`;

  if (isAlbum.length === 0) {
    res.status(404).json({
      message: "No album with this id",
    });
    return;
  }

  await sql`DELETE FROM songs WHERE album_id = ${id}`;

  await sql`DELETE FROM albums WHERE id = ${id}`;

  if (redisClient.isReady) {
    await redisClient.del("albums");
    console.log("Cache invalidated for albums");
  }

  if (redisClient.isReady) {
    await redisClient.del("songs");
    console.log("Cache invalidated for songs");
  }

  res.json({
    message: "Album deleted successfully",
  });
});

export const deleteSong = TryCatch(async (req: AuthencatedRequest, res) => {
  if (req.user?.role !== "admin") {
    res.status(401).json({
      message: "You are not admin",
    });
    return;
  }

  const { id } = req.params;

  const song = await sql`SELECT * FROM songs WHERE id = ${id}`;

  if (song.length === 0) {
    res.status(404).json({
      message: "No song with this id",
    });
    return;
  }

  await sql`DELETE FROM  songs WHERE id = ${id}`;

  if (redisClient.isReady) {
    await redisClient.del("songs");
    console.log("Cache invalidated for songs");
  }

  res.json({
    message: "Song deleted successfully",
  });
});
