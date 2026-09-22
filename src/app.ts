import "dotenv/config";
import { type Request, type Response, type NextFunction } from "express";
import passport from "passport";
import express from "express";
import routes from "./routes/index.js";
import "./utils/passportJwt.js";
import * as z from "zod";
import { Brevo, BrevoError } from '@getbrevo/brevo';
const app = express();

app.use(express.static('public'));

app.use("/auth", routes.auth)
app.use("/posts", routes.post)
app.use(passport.authenticate("jwt", { session: false }));
app.use("/product", routes.product)
app.use("/category", routes.category)
app.use("/campaign", routes.campaign)
app.use("/comments", routes.comment)
app.use("/address", routes.address)
app.use("/cart", routes.cart)
app.use("/users", routes.user)

app.get("/", (req: Request, res: Response) => {
  return res.json({
    message: "Welcome to my world!",
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof z.ZodError) {
    return res.status(500).json({ error: err.issues });
  }
  if (err instanceof Brevo.UnauthorizedError) {
    console.error('Invalid API key');
  } else if (err instanceof Brevo.TooManyRequestsError) {
    const retryAfter = 60;
    console.error(`Rate limited. Retry after ${retryAfter}s`);
  } else if (err instanceof BrevoError) {
    console.error(`API error ${err.statusCode}:`, err.message);
  }
  if (err) return res.status(500).json({ error: err.message });
});
app.listen(process.env.PORT, () => {
  console.log("Server listening on 3000!");
});
