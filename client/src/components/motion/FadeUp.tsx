
import { motion, easeInOut } from "framer-motion";
import { ReactNode } from "react";

type FadeUpProps = {
  children: ReactNode;
};

const FadeUp: React.FC<FadeUpProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 80, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: easeInOut, delay: 0.15 }}
    >
      {children}
    </motion.div>
  );
};

export default FadeUp;
