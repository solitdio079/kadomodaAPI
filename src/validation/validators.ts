import * as z from "zod"
import {Role,Status} from "../generated/prisma/index.js"

const UserValidator = z.object({
    name: z.string().trim().min(2,"You must enter your name!").normalize(),
    email: z.email("Email is invalid"),
    password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{8,}$/,{error: `Password must have at least 8 characters one lowercase letter, one uppercase letter, one number, one special character, and no spaces.`}),
    confirmPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{8,}$/)
})

const UserUpdateValidator = z.object({
    name: z.string().trim().min(2,"You must enter your name!").normalize().optional(),
    email: z.email("Email is invalid").optional(),
    password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{8,}$/,{error: `Password must have at least 8 characters one lowercase letter, one uppercase letter, one number, one special character, and no spaces.`}).optional(),

})


const CartProductValidator = z.array(z.object({
    productId: z.number(),
    name:z.string().min(3, {error: (iss) => `${iss.input} must have at least 3 characters!`}),
    size: z.string("Please enter a size"),
    quantity: z.number(),
    cartId: z.number(),
    image: z.string(),
    price:z.string().regex(/^\d+(\.\d+)?$/, "Invalid decimal format")
}))

const CartValidator = z.object({
    userId: z.number()
})

const UserUpdatePassword = z.object({
    token: z.string("Please enter a valid token"),
    password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{8,}$/,{error: `Password must have at least 8 characters one lowercase letter, one uppercase letter, one number, one special character, and no spaces.`}),
    confirmPassword: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])\S{8,}$/)
})

const UserRoleValidator = z.object({
    role: z.enum(Role)
})

const PostStatusValidator = z.object({
    status: z.enum(Status)
})
const PostValidator = z.object({
    title: z.string().min(3,{error: (iss) => `${iss.input} must have at least 3 characters!`}),
    content: z.string().normalize(),
    status: z.enum(Status).optional(),
    mediaString: z.string().regex(/^\w+(?:,\w+)*$/,{error: (iss) => `${iss.input} must have at comma separated words.`}).optional(),
    topicString: z.string().regex(/^\w+(?:,\w+)*$/, {error: (iss) => `${iss.input} must have comma separated words!`}).optional()
})

const CampaignValidator = z.object({
    name: z.string().min(3, {error: (iss) => `${iss.input} must have at least 4 characters!`}),
    discount: z.number("Please enter the discounted amount!")
})

const ProductValidator = z.object({
    name: z.string().min(3,{error: (iss) => `${iss.input} must have at least 3 characters!`}),
    details: z.string().min(10, {error: (iss) => `${iss.input} must have at least 10 characters!`}),
    sizesString: z.string().regex(/^\w+(?:,\w+)*$/,{error: (iss) => `${iss.input} must have at comma separated words.`}),
    total_qty: z.number("Please proviide a total quantity"),
    price: z.string().regex(/^\d+(\.\d+)?$/, "Invalid decimal format"),
    campaignId: z.number().optional(),
    variant: z.string("Please provide a variant"),
    categoryId: z.number().optional()
})


const CategoryValidator = z.object({
    name: z.string().min(3, {error: (iss) => `${iss.input} must have at least 3 characters!`})
})

const CommentValidator = z.object({
    content: z.string().trim().min(3,"Your comment must not be empty! It must be at least 3 characters!").normalize(),
    postId: z.string().transform((idString) => parseInt(idString))

})

export {
     CommentValidator,
     PostValidator,
     UserValidator,
     UserUpdateValidator,
     UserRoleValidator, 
     PostStatusValidator, 
     UserUpdatePassword,
     ProductValidator,
     CategoryValidator,
     CampaignValidator,
     CartProductValidator,
     CartValidator
    }