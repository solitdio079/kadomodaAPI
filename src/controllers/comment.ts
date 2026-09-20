import { prisma } from "../lib/prisma.js";
import checkIfAuthor from "../utils/authorCheck.js";

import { type Request, type Response, type NextFunction } from "express";

import {CommentValidator} from "../validation/validators.js"

interface commentParams {
  commentId: string;
}
interface Comment {
  id: number;
  content: string;
  postId: number;
  authorId: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}
interface commentBody {
  content: string;
  postId: number;
}

function validateComment(
  req: Request<any, any, commentBody>,
  res: Response,
  next: NextFunction,
){
  const result  = CommentValidator.safeParse(req.body)

  if(!result.success){
    next(result.error)
  }else{
    req.body = result.data
    next()
  }

}
async function createComment(
  req: Request<any, any, commentBody>,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) return res.status(403).json({ error: "You are logged in!" });
  // Data after validation succeeded
  const { content, postId } = req.body;
  const authorId = req.user.id;

  try {
    const comment = await prisma.comment.create({
      data: {
        content,
        authorId,
        postId,
      },
    });

    return res.json({
      data: comment,
      message: "Comment created with success!",
    });
  } catch (err) {
    next(err);
  }
}

async function checkIfCommentExists(
  commentId: number,
): Promise<boolean | Comment> {
  try {
    const checkComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!checkComment) return false;
    return checkComment;
  } catch (err) {
    throw err;
  }
}

async function updateComment(
  req: Request<commentParams, any, commentBody>,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) return res.status(404).json({ error: "You are logged in!" });
  const { commentId } = req.params;

  const checkComment = await checkIfCommentExists(parseInt(commentId));

  if (typeof checkComment === "boolean")
    return res.status(404).json({ error: "comment not found!" });

  if (!checkIfAuthor(checkComment.authorId, req.user.id))
    return res.status(403).json({ error: "You are not the author" });

  const { content, postId } = req.body;
  const authorId = req.user.id;

  try {
    const comment = await prisma.comment.update({
      where: { id: parseInt(commentId) },
      data: {
        content,
      },
    });
    return res.json({ data: comment, message: "Comment edited with success!" });
  } catch (err) {
    next(err);
  }
}

async function deleteComment(
  req: Request<commentParams>,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) return res.status(404).json({ error: "You are logged in!" });
  const { commentId } = req.params;

  const checkComment = await checkIfCommentExists(parseInt(commentId));
  if (typeof checkComment === "boolean")
    return res.status(404).json({ error: "comment not found!" });

  // CHECK iF this is the author
  if (!checkIfAuthor(checkComment.authorId, req.user.id))
    return res.status(403).json({ error: "You are not the author" });

  try {
    const deletedComment = await prisma.comment.delete({
      where: { id: parseInt(commentId) },
    });
    return res.json({
      data: deletedComment,
      message: "Comment deleted with success!",
    });
  } catch (err) {
    next(err);
  }
}

export { createComment, updateComment, deleteComment,validateComment };
