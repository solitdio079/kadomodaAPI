import { prisma } from "../lib/prisma.js";

import { type Request, type Response, type NextFunction } from "express";
import { Role, Status } from "../generated/prisma/index.js";

import {
  PostValidator,
  PostStatusValidator,
} from "../validation/validators.js";

interface Post {
  id: number;
  title: string;
  content: string | null;
  published: boolean;
  authorId: number;
  status?: string;
  media?: string[];
  topics?: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}
interface postParams {
  postId: string;
}

interface postBody {
  title: string;
  content: string;
  status?: Status;
  mediaString?: string;
  topicString?: string;
}

 async function uploadMedia(req:Request, res:Response,next:NextFunction){
  const files = req.files as Express.Multer.File[] | undefined;
  if(!files) return res.status(403).json({error: "Please upload some files!"})

  const media = files.map(item => item.filename)

  return res.json({data:media})
 }

async function getAllPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const posts = await prisma.post.findMany();
    return res.json({ data: posts });
  } catch (err) {
    next(err);
  }
}

async function getOnePost(
  req: Request<postParams>,
  res: Response,
  next: NextFunction,
) {
  const { postId } = req.params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: parseInt(postId) },
      include: { comments: true },
    });
    if (!post) return res.json({ message: "Post not found!" });
    return res.json({ data: post });
  } catch (err) {
    next(err);
  }
}

async function getPostComments(
  req: Request<postParams>,
  res: Response,
  next: NextFunction,
) {
  const { postId } = req.params;
  try {
    const comments = await prisma.comment.findMany({
      where: { postId: parseInt(postId) },
    });

    return res.json({ data: comments });
  } catch (err) {
    next(err);
  }
}

function validatePost(
  req: Request<postParams, any, postBody>,
  res: Response,
  next: NextFunction,
) {
  const result = PostValidator.safeParse(req.body);

  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }
}

function validatePostStatus(
  req: Request<postParams, any, { status: Status }>,
  res: Response,
  next: NextFunction,
) {
  const result = PostStatusValidator.safeParse(req.body);

  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }
}

async function createPost(
  req: Request<postParams, any, postBody>,
  res: Response,
  next: NextFunction,
) {
  if (!req.user || req.user.role !== Role.ADMIN)
    return res
      .status(403)
      .json({ error: "You are not allowed to do this action!" });
  // Data on req.body after validation
  const { title, content, mediaString, topicString, status } = req.body;
  const topics = topicString ? topicString.split(",") : [];
  const media = mediaString ? mediaString.split(",") : [];

  const authorId = req.user.id;

  try {
    const post = await prisma.post.create({
      data: {
        title,
        status: status || Status.PRIVATE,
        content,
        authorId,
        media,
        topics,
      },
    });
    return res.json({ data: post, message: "Post created successfully!" });
  } catch (err) {
    next(err);
  }
}

async function checkIfPostExists(postId: number): Promise<boolean | Post> {
  try {
    const checkPost = await prisma.post.findUnique({
      where: { id: postId },
    });
    if (!checkPost) return false;
    return checkPost;
  } catch (err) {
    throw err;
  }
}

async function updateStatus(
  req: Request<postParams, any, { status: Status }>,
  res: Response,
  next: NextFunction,
) {
  const { postId } = req.params;
  const { status } = req.body;
  try {
    await prisma.post.update({
      where: {
        id: parseInt(postId),
      },
      data: {
        status: status,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updatePost(
  req: Request<postParams, any, postBody>,
  res: Response,
  next: NextFunction,
) {
  if (!req.user || req.user.role !== Role.ADMIN)
    return res
      .status(403)
      .json({ error: "You are not allowed to do this action!" });
  const { postId } = req.params;

  const checkPost = await checkIfPostExists(parseInt(postId));

  if (typeof checkPost === "boolean")
    return res.status(404).json({ error: "This post was not found" });

  // Data on req.body after validation
  const { title, content, mediaString, topicString, status } = req.body;
  const authorId = req.user.id;
  const topics = topicString ? topicString.split(",") : undefined;
  const media = mediaString ? mediaString.split(",") : undefined;
  try {
    const post = await prisma.post.update({
      where: { id: parseInt(postId) },
      data: {
        title: title || checkPost.title,
        content: content || checkPost.content,
        authorId: authorId || checkPost.authorId,
        media: media || checkPost.media,
        status: status,
        topics: topics || checkPost.topics,
      },
    });
    return res.json({ data: post, message: "Post updated with success!" });
  } catch (err) {
    next(err);
  }
}

async function deletePost(
  req: Request<postParams>,
  res: Response,
  next: NextFunction,
) {
  const { postId } = req.params;
  const checkPost = await checkIfPostExists(parseInt(postId));

  if (typeof checkPost === "boolean")
    return res.status(404).json({ error: "post not found" });

  try {
    const post = await prisma.post.delete({
      where: { id: parseInt(postId) },
    });
    return res.json({ data: post, message: "Post deleted with success!" });
  } catch (err) {
    next(err);
  }
}

export {
  getAllPosts,
  getOnePost,
  createPost,
  updatePost,
  deletePost,
  getPostComments,
  validatePost,
  validatePostStatus,
  updateStatus,
  uploadMedia
};
