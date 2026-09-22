import * as z from "zod"
import {Role,Status, OrderStatus, PaymentStatus} from "../generated/prisma/index.js"

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

const bulkProductValidator = z.object({
  name: z.string().trim().min(1),
  sizes: z.array(z.string().trim().min(1)),
  total_qty: z.number().int().min(0).max(2147483647),

  // Decimal(10,2): up to 8 integer digits and 2 decimal places.
  // This endpoint accepts nonnegative prices as strings.
  price: z.string().regex(
    /^\d{1,8}(\.\d{1,2})?$/,
    "Price must be a nonnegative amount with up to 2 decimal places",
  ),

  variant: z.string().trim().min(1),
}).strict();

const bulkUploadSchema = z.array(bulkProductValidator).min(1).max(1000);

const AddressValidator = z.object({
    name: z.string().min(2, {error: (iss) => `${iss.input} must have at least 3 characters!`}),
    phone:z.string().regex(/^\+?[0-9]{7,15}$/, "Invalid phone format"),
    address: z.string().min(10,  {error: (iss) => `${iss.input} must have at least 3 characters!`}),
    city: z.string("Please enter a city!"),
    country: z.string("Please enter a country"),
    zipCode: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/, "Invalid zip code"),
    userId: z.number("We need an owner!")
})

const OrderProductValidator = z.array(z.object({
    productId: z.number(),
    name:z.string().min(3, {error: (iss) => `${iss.input} must have at least 3 characters!`}),
    size: z.string("Please enter a size"),
    quantity: z.number(),
    image: z.string(),
    price:z.string().regex( /^\d{1,8}(\.\d{1,2})?$/, "Invalid decimal format")
}))


const CartProductValidator = z.array(z.object({
    productId: z.number(),
    name:z.string().min(3, {error: (iss) => `${iss.input} must have at least 3 characters!`}),
    size: z.string("Please enter a size"),
    quantity: z.number(),
    cartId: z.number(),
    image: z.string(),
    price:z.string().regex( /^\d{1,8}(\.\d{1,2})?$/, "Invalid decimal format")
}))

const CartValidator = z.object({
    userId: z.number()
})

const OrderValidator = z.object({
    status: z.enum(OrderStatus),
    addressId: z.number("Please choose an address"),
    orderProducts: OrderProductValidator,
    userId: z.number("Please choose a user")
})

const PaymentValidator = z.object({
    status: z.enum(PaymentStatus),
    orderId: z.number("Order ID is missing"),
    intent:z.string().optional(),
    method: z.string().optional()
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
    price: z.string().regex( /^\d{1,8}(\.\d{1,2})?$/, "Invalid decimal format"),
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
     CartValidator,
     AddressValidator,
     OrderValidator,
     PaymentValidator,
     OrderProductValidator,
     bulkProductValidator,
     bulkUploadSchema
    }