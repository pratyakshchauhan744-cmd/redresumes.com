import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

export const TemplatePreviewScaler = ({
  children,
  zoom = 1,
  pageWidth = 960,
}: {
  children: ReactNode;
  zoom?: number;
  pageWidth?: number;
}) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const updateSize = () => {
      setSize({
        width: shellRef.current?.getBoundingClientRect().width || 0,
        height: pageRef.current?.scrollHeight || 0,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    if (shellRef.current) resizeObserver.observe(shellRef.current);
    if (pageRef.current) resizeObserver.observe(pageRef.current);

    return () => resizeObserver.disconnect();
  }, [pageWidth, children]);

  const scale = (size.width ? Math.min(1, size.width / pageWidth) : 0) * zoom;
  const scaledHeight = size.height * scale;

  return (
    <div ref={shellRef} className="template-preview-scale-shell mx-auto w-full min-w-0 max-w-full">
      <div
        className="template-preview-scale-stage mx-auto"
        style={{ width: pageWidth * scale, height: scaledHeight }}
      >
        <div
          ref={pageRef}
          className="template-preview-scale-page origin-top-left"
          style={{
            width: pageWidth,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
