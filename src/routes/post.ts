import express, { Router } from "express";
import passport from "passport"
import verifyIfAdmin from "../utils/verifyIfAdmin.js"
import upload from "../utils/multerUpload.js"
import {
  getAllPosts,
  getOnePost,
  updatePost,
  createPost,
  deletePost,
  getPostComments,
  validatePost,
  validatePostStatus,
  updateStatus,
  uploadMedia
} from "../controllers/post.js";

import "../utils/passportJwt.js"

const router = Router();


router.post("/media", upload.array("media",4), uploadMedia)

router.use(express.json());

router.get("/:postId/comments", getPostComments)
router.get("/:postId", getOnePost);

router.use(passport.authenticate('jwt', {session:false}))
router.get("/", verifyIfAdmin,getAllPosts);
router.post("/", verifyIfAdmin, validatePost, createPost);

router.put("/:postId", verifyIfAdmin, validatePost,updatePost);
router.patch("/:postId", verifyIfAdmin, validatePostStatus,updateStatus);

router.delete("/:postId", verifyIfAdmin,deletePost);

export default router;
