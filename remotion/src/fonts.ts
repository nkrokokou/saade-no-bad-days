import { loadFont as loadHeading } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/DMSans";

export const heading = loadHeading("normal", { weights: ["400", "600", "700"], subsets: ["latin"] }).fontFamily;
export const body = loadBody("normal", { weights: ["300", "400", "500", "600"], subsets: ["latin"] }).fontFamily;
