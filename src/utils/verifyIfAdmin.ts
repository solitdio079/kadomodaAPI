import {type Request, type Response,type NextFunction} from "express"
import {Role} from "../generated/prisma/index.js"


function verifyIfAdmin(req:Request<{userId:string}|{commentId:string}|{postId:string}>,res:Response,next:NextFunction): Response|void{
  if(!req.user) return  res.status(401).json({error: "You are not logged in!"})
  if(req.user.role !==Role.ADMIN) return res.status(403).json({error: "You are not the admin!"})
  return next()
}

export default verifyIfAdmin