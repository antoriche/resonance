import React from "react";

const AudioVizualizer = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        overflowX: "hidden",
        maxWidth: "100%",
      }}
    >
      {Array.from({ length: 150 }).map((_, index) => (
        <div
          key={index}
          style={{
            width: 3,
            flexShrink: 0,
            height: index % 2 === 0 ? 20 : 10,
            backgroundColor: "var(--primary-color)",
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
};

export default AudioVizualizer;
