import jwt from "jsonwebtoken"
import "dotenv/config"
export default function createToken(payload:{id:number},expires:number){
    const secret = process.env.SECRET_KEY
    if(!secret) return ""
    const token = jwt.sign(payload,secret,{algorithm: "HS256", expiresIn:expires})

    return token
}
