import DashboardNav from "../components/DashboardNav";
import React, { useState, useRef, useEffect } from "react";
import { IoResize } from "react-icons/io5";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="flex">
      <DashboardNav />
      {children}
      {showVideo && <DraggableVideo src="/subway-surfer.mp4" />}

      {/* Toggle button fixed at bottom-right */}
      <button
        onClick={() => setShowVideo((prev) => !prev)}
        className="fixed bottom-4 right-4 z-50 p-2 bg-blue-600 text-white rounded shadow-lg cursor-pointer hover:bg-blue-500 transition-all"
      >
        {showVideo ? "Hide Brainrot" : "Show Brainrot"}
      </button>
    </div>
  );
};

export default DashboardLayout;

interface DraggableVideoProps {
  src: string;
  /** Width in pixels (used for resizing) */
  width?: number;
  /** Aspect ratio [widthRatio, heightRatio], default 9:16 */
  aspectRatio?: [number, number];
  initialX?: number;
  initialY?: number;
}

const DraggableVideo: React.FC<DraggableVideoProps> = ({
  src,
  width = 300,
  aspectRatio = [9, 16],
  initialX = 100,
  initialY = 100,
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({
    width,
    height: (width * aspectRatio[1]) / aspectRatio[0],
  });

  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const moveOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ mouseX: 0, initialWidth: size.width });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (resizingRef.current) return;
    draggingRef.current = true;
    moveOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    resizingRef.current = true;
    resizeStartRef.current = { mouseX: e.clientX, initialWidth: size.width };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (resizingRef.current) {
      const dx = e.clientX - resizeStartRef.current.mouseX;
      const newWidth = Math.max(50, resizeStartRef.current.initialWidth + dx);
      const newHeight = (newWidth * aspectRatio[1]) / aspectRatio[0];
      setSize({ width: newWidth, height: newHeight });
    } else if (draggingRef.current) {
      setPosition({
        x: e.clientX - moveOffsetRef.current.x,
        y: e.clientY - moveOffsetRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
    resizingRef.current = false;
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: position.y,
    left: position.x,
    width: size.width,
    height: size.height,
    cursor: draggingRef.current ? "grabbing" : "grab",
    zIndex: 1000,
  };

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: 16,
    height: 16,
    bottom: 0,
    right: 0,
    cursor: "se-resize",
    zIndex: 1001,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={containerStyle} onMouseDown={handleMouseDown}>
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
      />
      <div style={handleStyle} onMouseDown={handleResizeMouseDown}>
        <IoResize size={14} className="rotate-90 text-white" />
      </div>
    </div>
  );
};
