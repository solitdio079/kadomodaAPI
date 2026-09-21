import {prisma} from "../lib/prisma.js"
import {CategoryValidator} from "../validation/validators.js"
import {type Request, type Response, type NextFunction} from "express"
import {Role} from "../generated/prisma/index.js"
interface categoryBody{
  name: string
}
interface categoryParams {
    categoryId: string
}

async function validateCategory(
  req: Request<categoryParams, any, categoryBody>,
  res: Response,
  next: NextFunction,
) {
  const result = CategoryValidator.safeParse(req.body);

  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }
}

async function createCategory(req:Request<categoryParams, any, categoryBody>, res:Response, next:NextFunction){
    // Permission checks
    if(!req.user) return res.status(403).json({error: "Unauthorized"})
    if(req.user.role !== Role.ADMIN) return res.status(403).json({error: "Unauthorized"})
    const {name} = req.body

    try{
        const category = await prisma.category.create({
            data:{
                name
            }
        })

        return res.json({ data: category, message: "Category created successfully!" });

    }catch(err){
        next(err)
    }


}

async function getOneCategory(req:Request<categoryParams>, res:Response, next:NextFunction){
    const {categoryId} = req.params

    try{
        const category = await prisma.category.findUnique({
            where:{
                id: parseInt(categoryId)
            }
        })

        return res.json({data:category})

    }catch(err){
        next(err)
    }
}


async function getAllCategories(req:Request, res:Response, next:NextFunction){

    try{
        const categories = await prisma.category.findMany()
        return res.json({data:categories})

    }catch(err){
        next(err)
    }

    
}

async function editCategory(req:Request<categoryParams, any, categoryBody>, res:Response, next:NextFunction){
     // Permission checks
    if(!req.user) return res.status(403).json({error: "Unauthorized"})
    if(req.user.role !== Role.ADMIN) return res.status(403).json({error: "Unauthorized"})
    const {categoryId} = req.params 

    try{
        const {name} = req.body 

        const category = await prisma.category.update({
            where: {
                id: parseInt(categoryId)
            },
            data:{
                name
            }
        })

        return res.json({data:category, message: "Category edited successfully!"})

    }catch(err){
        next(err)
    }
}

async function deleteCategory(req:Request<categoryParams, any, categoryBody>, res:Response, next:NextFunction){
    // Permission checks
    if(!req.user) return res.status(403).json({error: "Unauthorized"})
    if(req.user.role !== Role.ADMIN) return res.status(403).json({error: "Unauthorized"})

    const {categoryId} = req.params 

    try{
      
        const category = await prisma.category.delete({
            where: {
                id: parseInt(categoryId)
            }
        })

        return res.json({data:category, message: "Category deleted successfully!"})

    }catch(err){
        next(err)
    }
}



export  {createCategory, getOneCategory, getAllCategories, editCategory, deleteCategory, validateCategory}