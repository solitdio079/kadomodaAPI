import { prisma } from "../lib/prisma.js";
import { type Request, type Response, type NextFunction } from "express";
import {
  ProductValidator,
  bulkProductValidator,
  bulkUploadSchema,
} from "../validation/validators.js";
import { Role } from "../generated/prisma/index.js";

import ExcelJS from "exceljs";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { z } from "zod";
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
        campaignId: campaignId || undefined,
        variant,
        categoryId: categoryId || undefined,
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
const productSchema = z.object({
  name: z.string().trim().min(1),

  sizes: z
    .string()
    .transform((value) => value.split("|").map((size) => size.trim()))
    .pipe(z.array(z.string().min(1)).min(1)),

  total_qty: z
    .string()
    .regex(/^\d+$/, "Quantity must be a nonnegative integer")
    .transform(Number)
    .pipe(z.number().int().min(0).max(2147483647)),

  price: z
    .string()
    .regex(
      /^\d{1,8}(\.\d{1,2})?$/,
      "Use a nonnegative price with up to 2 decimal places",
    ),

  variant: z.string().trim().min(1),
});

const requiredColumns = ["name", "sizes", "total_qty", "price", "variant"];
async function createBulkProducts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.file) {
    res.status(400).json({ message: "Upload a file using the 'file' field" });
    return;
  }

  const filePath = req.file.path;

  try {
    const workbook = new ExcelJS.Workbook();
    const extension = path.extname(req.file.originalname).toLowerCase();

    try {
      if (extension === ".csv") {
        await workbook.csv.readFile(filePath, {
          map: (value: string) => value, // Preserve CSV values as text
        });
      } else {
        await workbook.xlsx.readFile(filePath);
      }
    } catch {
      res.status(400).json({ message: "Could not read the uploaded file" });
      return;
    }

    const sheet = workbook.worksheets[0];

    if (!sheet || sheet.rowCount < 2) {
      res.status(400).json({ message: "The file contains no product rows" });
      return;
    }

    const headers = Array.from({ length: sheet.columnCount }, (_, index) =>
      sheet
        .getRow(1)
        .getCell(index + 1)
        .text.trim(),
    );

    if (
      headers.length !== requiredColumns.length ||
      !requiredColumns.every((column) => headers.includes(column))
    ) {
      res.status(400).json({
        message: "Include exactly these column headers",
        columns: requiredColumns,
      });
      return;
    }

    const products: z.infer<typeof productSchema>[] = [];
    const errors: { row: number; issues: z.ZodIssue[] }[] = [];
    let productRowCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const values = headers.map((_, index) =>
        row.getCell(index + 1).text.trim(),
      );

      if (values.every((value) => value === "")) return;

      productRowCount++;
      if (productRowCount > 1000) return;

      const rawProduct = Object.fromEntries(
        headers.map((header, index) => [header, values[index]]),
      );

      const result = productSchema.safeParse(rawProduct);

      if (result.success) {
        products.push(result.data);
      } else {
        errors.push({ row: rowNumber, issues: result.error.issues });
      }
    });

    if (productRowCount === 0 || productRowCount > 1000) {
      res.status(400).json({
        message: "Upload between 1 and 1000 product rows",
      });
      return;
    }

    if (errors.length > 0) {
      res.status(400).json({
        message: "Fix these rows and upload again. Nothing was inserted.",
        errors,
      });
      return;
    }

    const result = await prisma.product.createMany({
      data: products,
    });

    res.status(201).json({ count: result.count });
  } catch (error) {
    next(error);
  } finally {
    await unlink(filePath).catch((error) => {
      console.error("Could not delete temporary import:", error);
    });
  }
}
async function putProduct(
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

async function patchProduct(
  req: Request<productParams, any, productBody>,
  res: Response,
  next: NextFunction,
) {
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
      include: {
        campaign: true,
        category: true,
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
    const products = await prisma.product.findMany({
      include: {
        campaign: true,
        category: true,
      },
    });

    return res.json({ data: products });
  } catch (err) {
    next(err);
  }
}
async function getCampaignProducts(
  req: Request<{ campaignId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const products = await prisma.product.findMany({
      where: {
        campaignId: parseInt(req.params.campaignId),
      },
      include: {
        campaign: true,
        category: true,
      },
    });

    return res.json({ data: products });
  } catch (err) {
    next(err);
  }
}
async function getCategoryProducts(
  req: Request<{ categoryId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const products = await prisma.product.findMany({
      where: {
        campaignId: parseInt(req.params.categoryId),
      },
      include: {
        campaign: true,
        category: true,
      },
    });

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
  getCategoryProducts,
  getCampaignProducts,
  createBulkProducts,
};
