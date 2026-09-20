import { prisma } from "../src/lib/prisma.js";



async function getAllPosts(req, res, next) {
  try {
    const posts = await prisma.post.findMany();
    return res.json({ data: posts });
  } catch (err) {
    next(err);
  }
}

async function getOnePost(req, res, next) {
  const { postId } = req.params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include:{comments:true}
    });
    if (!post) return res.json({ message: "Post not found!" });
    return res.json({ data: post });
  } catch (err) {
    next(err);
  }
}

async function getPostComments(req, res, next) {
  const { postId } = req.params;
  try {
    const comments = await prisma.comment.findMany({
      where: { postId },
    });
   
    return res.json({ data: comments });
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  // Data on req.body after validation
  const { title, content, media, topicString } = req.body;
  const topics = topicString.split(",");

  const authorId = req.user.id

  try {
    const post = await prisma.post.create({
      data: {
        title,
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

async function checkIfPostExists(postId, res) {
  try {
    const checkPost = await prisma.post.findUnique({
      where: { id: postId },
    });
    if (!checkPost) return res.json({ message: "Post not found!" });
    return checkPost;
  } catch (err) {
    throw err;
  }
}

async function updatePost(req, res, next) {
  const { postId } = req.params;

  const checkPost = await checkIfPostExists(postId, res);

  // Data on req.body after validation
  const { title, content, media, topicString } = req.body;
  const authorId = req.user.id
  const topics = topicString.split(",");
  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        title: title || checkPost.title,
        content: content || checkPost.content,
        authorId: authorId || checkPost.authorId,
        media: media || checkPost.media,
        topics: topics || checkPost.topics,
      },
    });
    return res.json({ data: post, message: "Post updated with success!" });
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  const { postId } = req.params;
  const checkPost = await checkIfPostExists(postId, res);

  try{
    const post = await prisma.post.delete({
        where: {id:postId}
    })
    return res.json({data:post, message: 'Post deleted with success!'})
  }catch(err){
    next(err)
  }
}


export {getAllPosts,getOnePost,createPost,updatePost, deletePost, getPostComments};
