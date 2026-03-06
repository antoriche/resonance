import React from "react";

type VerticalTextProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  line?: boolean;
};
const VerticalText: React.FC<VerticalTextProps> = ({
  children,
  style,
  line = true,
}) => {
  return (
    <div
      style={{
        writingMode: "vertical-rl",
        textOrientation: "mixed",
        transform: "rotate(180deg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        ...style,
      }}
    >
      {line ? (
        <div
          style={{
            width: "1px",
            flexGrow: 1,
            minHeight: 5,
            backgroundColor: "currentColor",
          }}
        />
      ) : null}
      {children}
      {line ? (
        <div
          style={{
            width: "1px",
            flexGrow: 1,
            minHeight: 5,
            backgroundColor: "currentColor",
          }}
        />
      ) : null}
    </div>
  );
};

export default VerticalText;
