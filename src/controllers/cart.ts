/*model Cart {
  id Int @id @default(autoincrement())
  products Int[]
  sizes String[]
  quantities Int[]
  subtotal Decimal @db.Decimal(10,2)
  user User @relation(fields:[userId], references:[id])
  userId Int @unique
}*/
import { prisma } from "../lib/prisma.js";
import {
  CartValidator,
  CartProductValidator,
} from "../validation/validators.js";
import { type Request, type Response, type NextFunction } from "express";

interface CartParams {
  cartId?: string;
}

interface CartProductBody {
  productId: number;
  name: string;
  size: string;
  quantity: number;
  cartId: number;
  image: string;
  price: string;
}

function getSubtotal(cart: CartProductBody[]) {
  return cart.reduce(
    (acc, curr) => (acc += parseFloat(curr.price) * curr.quantity),
    0,
  );
}

async function validateCartProduct(
  req: Request<CartParams, any, CartProductBody[]>,
  res: Response,
  next: NextFunction,
) {
  const result = CartProductValidator.safeParse(req.body);
  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }
}

async function createCart(req: Request, res: Response, next: NextFunction) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  try {
    const cart = await prisma.cart.create({
      data: {
        userId: req.user.id,
      },
    });

    return res
      .status(201)
      .json({ data: cart, message: "Cart created successfully!" });
  } catch (err) {
    next(err);
  }
}

async function editCart(
  req: Request<CartParams, any, CartProductBody[]>,
  res: Response,
  next: NextFunction,
) {
  try {
    //
    const { cartId } = req.params;
    if (typeof cartId !== "string")
      return res.status(403).json({ error: "cart id is missing!" });

    // check cart

    const checkCart = await prisma.cart.findUnique({
      where: {
        id: parseInt(cartId),
      },
      include: {
        cartProducts: true,
      },
    });
    if (!checkCart) return res.status(404).json({ error: "cart is missing!" });

    //

    // DELETE ALL the old cartproducts related to this cart
    await prisma.cartProduct.deleteMany({
      where: {
        cartId: parseInt(cartId),
      },
    });

    // create new cartProducts related to this cart
    const newCartProducts = req.body;
    await prisma.cartProduct.createMany({
      data: newCartProducts,
    });

    // update cart subtotal to new Cart product subtotal
    await prisma.cart.update({
      where: {
        id: parseInt(cartId),
      },
      data: {
        subtotal: getSubtotal(newCartProducts),
      },
    });

    return res.json({ message: "Cart updated with success" });
  } catch (err) {
    next(err);
  }
}

async function getCart(req: Request, res: Response, next: NextFunction) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });

  try {
    let cart = await prisma.cart.findUnique({
      where: {
        userId: req.user.id,
      },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: req.user.id,
        },
      });
    }

    return res.status(201).json({ data: cart });
  } catch (err) {
    next(err);
  }
}

async function clearCart(
  req: Request<CartParams, any, CartProductBody[]>,
  res: Response,
  next: NextFunction,
) {
    try{
         //
    const { cartId } = req.params;
    if (typeof cartId !== "string")
      return res.status(403).json({ error: "cart id is missing!" });

    // check cart

    const checkCart = await prisma.cart.findUnique({
      where: {
        id: parseInt(cartId),
      },
      include: {
        cartProducts: true,
      },
    });
    if (!checkCart) return res.status(404).json({ error: "cart is missing!" });

    //

    // DELETE ALL the old cartproducts related to this cart
    await prisma.cartProduct.deleteMany({
      where: {
        cartId: parseInt(cartId),
      },
    });

    return res.json({message: "Cart cleared successfully!"})


    }catch(err){
        next(err)
    }

}

export { createCart, editCart, getCart,  validateCartProduct,clearCart };
