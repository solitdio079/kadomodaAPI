import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/utils/password.js";

async function getAllUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      omit: {
        pwd: true,
      },
    });
    return res.json({ data: users });
  } catch (err) {
    next(err);
  }
}

async function getOneUser(req, res, next) {
  
  const { userId } = req.params;
  if(req.user.id !== parseInt(userId)) return res.status(403).json({error: "You are not the user here"})
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      omit: {
        pwd: true,
      },
    });
    if (!user) return res.json({ message: "User not Found!" });

    return res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

async function getUserComments(req, res, next) {
  const { userId } = req.params;
  try {
    const comments = await prisma.comment.findMany({
      where: { authorId: userId },
    });

    return res.json({ data: comments });
  } catch (err) {
    next(err);
  }
}

async function getUserPosts(req, res, next) {
  const { userId } = req.params;
  try {
    const posts = await prisma.post.findMany({
      where: { authorId: userId },
    });

    return res.json({ data: posts });
  } catch (err) {
    next(err);
  }
}

// Helper Check User function

async function checkIfUserExists(userId, res) {
  // Check if user exists
  try {
    const checkUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!checkUser) return res.status(404).json({ message: "User not found!" });
    return checkUser;
  } catch (err) {
    throw err;
  }
}

// createUser is handled in my authentication flow already

async function updateUser(req, res, next) {
 
  const { userId } = req.params;
  if(parseInt(userId) !== req.user.id && req.user.role !=="ADMIN") return res.status(403).json({error: "You are forbidden from changing this user's infos!"})
  const checkUser = await checkIfUserExists(parseInt(userId), res);

  const { email, name, pwd } = req.body;

  try {
    // TODO:: HASH PASSWORD IF NECESSARY
    let hashed;
    if (pwd) {
      hashed = await hashPassword(pwd);
    }
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        email: email || checkUser.email,
        name: name || checkUser.name,
       
        pwd: hashed || checkUser.pwd,
       
      },
    });

    return res.json({
      data: { email: user.email, name: user.name },
      message: "User updated with success!",
    });
  } catch (err) {
    next(err);
  }
}

async function updateRole(req, res, next) {
  const { userId } = req.params;
  const checkUser = await checkIfUserExists(parseInt(userId), res);

  const { role } = req.body;

  try {
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        role: role || checkUser.role,
      },
    });

    return res.json({
      data: { role: user.role },
      message: "User updated with success!",
    });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  const { userId } = req.params;
  const checkUser = await checkIfUserExists(parseInt(userId), res);

  try {
    await prisma.user.delete({
      where: { id: parseInt(userId) },
    });
    return res.json({
      message: "User deleted with success",
      data: { name: checkUser.name, email: checkUser.email },
    });
  } catch (err) {
    next(err);
  }
}

export {
  getAllUsers,
  getOneUser,
  updateUser,
  deleteUser,
  getUserComments,
  getUserPosts,
  updateRole,
};
