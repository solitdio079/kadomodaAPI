import { prisma } from "../src/lib/prisma.js";
import checkIfAuthor from "../src/utils/authorCheck.js"
async function createComment(req, res, next) {
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

async function checkIfCommentExists(commentId, res) {
  try {
    const checkComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!checkComment) return res.json({ message: "Post not found!" });
    return checkComment;
  } catch (err) {
    throw err;
  }
}

async function updateComment(req, res, next) {
  const { commentId } = req.params;

  const checkComment = await checkIfCommentExists(commentId, res);

  if(!checkIfAuthor(checkComment.authorId, req.user.id)) return res.status(403).json({error: "You are not the author"})

  const { content, postId } = req.body;
  const authorId = req.user.id;

  try {
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
      },
    });
    return res.json({ data: comment, message: "Comment edited with success!" });
  } catch (err) {
    next(err);
  }
}


async function deleteComment(req,res,next){
  const { commentId } = req.params;

  const checkComment = await checkIfCommentExists(commentId, res);

  // CHECK iF this is the author
  if(!checkIfAuthor(checkComment.authorId, req.user.id)) return res.status(403).json({error: "You are not the author"})

  try{
    const deletedComment = await prisma.comment.delete({
        where:{id:commentId}
    })
    return res.json({data: deletedComment, message: 'Comment deleted with success!'})
  }catch(err){
    next(err)
  }
}


export {createComment, updateComment,deleteComment};
