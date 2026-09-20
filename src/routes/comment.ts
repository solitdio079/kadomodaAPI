import express, {Router} from "express"
import {createComment, updateComment, deleteComment, validateComment} from "../controllers/comment.js"
const router = Router()

router.use(express.json())

router.post("/", validateComment,createComment)

router.put("/:commentId", validateComment, updateComment)

router.delete("/:commentId", deleteComment)


export default router