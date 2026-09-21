import { prisma } from "../lib/prisma.js";
import { type Request, type Response, type NextFunction } from "express";
import { ProductValidator } from "../validation/validators.js";
import { Role } from "../generated/prisma/index.js";

interface productParams {
  productId?: string;
}

interface productBody {
  name: string;
  details: string;
  sizesString: string;
  total_qty: number;
  price: string;
  campaignId?: number;
  categoryId?: number;
  variant: string;
}

async function createOneProduct(
  req: Request<productParams, any, productBody>,
  res: Response,
  next: NextFunction,
) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });
  if (req.user.role !== Role.ADMIN)
    return res.status(403).json({ error: "Unauthorized" });
  // Get the images
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files)
    return res.status(403).json({ error: "Please upload some images!" });

  const images = files.map((item) => item.filename);

  // get the other fields
  const {
    name,
    details,
    sizesString,
    total_qty,
    price,
    campaignId,
    variant,
    categoryId,
  } = req.body;
  const sizes = sizesString.split(",");
  try {
    const product = await prisma.product.create({
      data: {
        name,
        details,
        sizes,
        total_qty,
        price,
        images,
        campaignId: campaignId || 0,
        variant,
        categoryId: categoryId || 0,
      },
    });

    return res.json({
      data: product,
      message: "Product created successfully!",
    });
  } catch (err) {
    next(err);
  }
}

async function putProduct(req: Request<productParams, any, productBody>, res: Response, next: NextFunction) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });
  if (req.user.role !== Role.ADMIN)
    return res.status(403).json({ error: "Unauthorized" });
  // Get the images
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files)
    return res.status(403).json({ error: "Please upload some images!" });

  const images = files.map((item) => item.filename);

  const { productId } = req.params;
  if (typeof productId !== "string")
    return res.status(403).json({ error: "ID params missing" });

  const checkProduct = await prisma.product.findUnique({
    where: {
      id: parseInt(productId),
    },
  });
  if (!checkProduct)
    return res.status(403).json({ error: "Product does not exist!" });

  // get the other fields
  const {
    name,
    details,
    sizesString,
    total_qty,
    price,
    campaignId,
    variant,
    categoryId,
  } = req.body;
  const sizes = sizesString.split(",");
  try {
    const product = await prisma.product.create({
      data: {
        name,
        details,
        sizes,
        total_qty,
        price,
        images,
        campaignId: campaignId || checkProduct.campaignId,
        variant,
        categoryId: categoryId || checkProduct.categoryId,
      },
    });

    return res.json({ data: product, message: "Product edited successfully!" });
  } catch (err) {
    next(err);
  }
}

async function patchProduct(req: Request<productParams, any, productBody>, res: Response, next: NextFunction) {
  // Permission checks
  if (!req.user) return res.status(403).json({ error: "Unauthorized" });
  if (req.user.role !== Role.ADMIN)
    return res.status(403).json({ error: "Unauthorized" });
  const { productId } = req.params;
  if (typeof productId !== "string")
    return res.status(403).json({ error: "ID params missing" });

  const checkProduct = await prisma.product.findUnique({
    where: {
      id: parseInt(productId),
    },
  });
  if (!checkProduct)
    return res.status(403).json({ error: "Product does not exist!" });

  // get the other fields
  const {
    name,
    details,
    sizesString,
    total_qty,
    price,
    campaignId,
    variant,
    categoryId,
  } = req.body;
  const sizes = sizesString.split(",");
  try {
    const product = await prisma.product.create({
      data: {
        name,
        details,
        sizes,
        total_qty,
        price,
        campaignId: campaignId || checkProduct.campaignId,
        variant,
        categoryId: categoryId || checkProduct.categoryId,
      },
    });

    return res.json({ data: product, message: "Product edited successfully!" });
  } catch (err) {
    next(err);
  }
}

async function getOneProduct(
  req: Request<productParams>,
  res: Response,
  next: NextFunction,
) {
  const { productId } = req.params;
  if (typeof productId !== "string")
    return res.status(403).json({ error: "Id params missing" });

  try {
    const product = await prisma.product.findUnique({
      where: {
        id: parseInt(productId),
      },
    });

    return res.json({ data: product });
  } catch (err) {
    next(err);
  }
}

async function getAllProducts(
  req: Request<productParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const products = await prisma.product.findMany();

    return res.json({ data: products });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(
  req: Request<productParams>,
  res: Response,
  next: NextFunction,
) {
  const { productId } = req.params;
  if (typeof productId !== "string")
    return res.status(403).json({ error: "ID params missing" });

  const checkProduct = await prisma.product.findUnique({
    where: {
      id: parseInt(productId),
    },
  });
  if (!checkProduct)
    return res.status(403).json({ error: "Product does not exist!" });

  try {
    const product = await prisma.product.delete({
      where: {
        id: parseInt(productId),
      },
    });

    return res.json({ message: "Product deleted!" });
  } catch (err) {
    next(err);
  }
}

function validateProduct(
  req: Request<productParams, any, productBody>,
  res: Response,
  next: NextFunction,
) {
  const result = ProductValidator.safeParse(req.body);

  if (!result.success) {
    next(result.error);
  } else {
    req.body = result.data;
    next();
  }
}

export {
  validateProduct,
  createOneProduct,
  putProduct,
  patchProduct,
  deleteProduct,
  getOneProduct,
  getAllProducts,
};
