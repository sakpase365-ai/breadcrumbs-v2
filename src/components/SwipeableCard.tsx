import { ReactNode, useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Trash2, Archive } from "lucide-react";

interface SwipeableCardProps {
  children: ReactNode;
  onDelete?: () => void;
  onArchive?: () => void;
  disabled?: boolean;
}

export function SwipeableCard({ 
  children, 
  onDelete, 
  onArchive,
  disabled = false 
}: SwipeableCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  
  // Transform for background reveal
  const deleteOpacity = useTransform(x, [-150, -80, 0], [1, 0.8, 0]);
  const archiveOpacity = useTransform(x, [0, 80, 150], [0, 0.8, 1]);
  const deleteScale = useTransform(x, [-150, -80, 0], [1, 0.9, 0.5]);
  const archiveScale = useTransform(x, [0, 80, 150], [0.5, 0.9, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    
    if (info.offset.x < -threshold && onDelete) {
      setIsDeleting(true);
      // Animate out then call delete
      setTimeout(() => {
        onDelete();
      }, 200);
    } else if (info.offset.x > threshold && onArchive) {
      onArchive();
    }
  };

  if (isDeleting) {
    return (
      <motion.div
        initial={{ height: "auto", opacity: 1 }}
        animate={{ height: 0, opacity: 0, marginBottom: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background (left swipe) */}
      <motion.div 
        className="absolute inset-0 bg-red-500/90 flex items-center justify-end px-6 rounded-xl"
        style={{ opacity: deleteOpacity }}
      >
        <motion.div 
          className="flex items-center gap-2 text-white font-medium"
          style={{ scale: deleteScale }}
        >
          <Trash2 className="w-5 h-5" />
          <span className="hidden sm:inline">Delete</span>
        </motion.div>
      </motion.div>

      {/* Archive background (right swipe) */}
      {onArchive && (
        <motion.div 
          className="absolute inset-0 bg-amber-500/90 flex items-center justify-start px-6 rounded-xl"
          style={{ opacity: archiveOpacity }}
        >
          <motion.div 
            className="flex items-center gap-2 text-white font-medium"
            style={{ scale: archiveScale }}
          >
            <Archive className="w-5 h-5" />
            <span className="hidden sm:inline">Archive</span>
          </motion.div>
        </motion.div>
      )}

      {/* Swipeable content */}
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        whileTap={{ cursor: "grabbing" }}
        className="relative z-10 touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}