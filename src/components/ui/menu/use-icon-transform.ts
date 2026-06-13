import { useRef, useEffect } from "react";
import { transform, MotionValue } from "framer-motion";

interface UseIconTransformProps {
    x: MotionValue<number>;
    y: MotionValue<number>;
    scale: MotionValue<number>;
    planeX: MotionValue<number>;
    planeY: MotionValue<number>;
    xOffset: number;
    yOffset: number;
    settings: {
        icon: { size: number; margin: number };
        device: { width: number; height: number };
    };
}

export function useIconTransform({
    x,
    y,
    scale,
    planeX,
    planeY,
    xOffset,
    yOffset,
    settings
}: UseIconTransformProps) {
    const xScale = useRef(1);
    const yScale = useRef(1);

    const { device, icon } = settings;
    const scaleFactor = device.width / 368;

    // Recalculate ranges based on current settings
    const createScreenRange = (axis: "width" | "height") => [
        -60 * scaleFactor,
        80 * scaleFactor,
        device[axis] - (icon.size + icon.margin) / 2 - 80 * scaleFactor,
        device[axis] - (icon.size + icon.margin) / 2 + 60 * scaleFactor
    ];

    const scaleRange = [0, 1, 1, 0];
    const xRange = createScreenRange("width");
    const yRange = createScreenRange("height");

    const mapScreenToXOffset = transform(xRange, [50 * scaleFactor, 0, 0, -50 * scaleFactor]);
    const mapScreenToYOffset = transform(yRange, [50 * scaleFactor, 0, 0, -50 * scaleFactor]);
    const mapScreenXToScale = transform(xRange, scaleRange);
    const mapScreenYToScale = transform(yRange, scaleRange);

    useEffect(() => {
        const updateX = (v: number) => {
            const screenOffset = v + xOffset + 20 * scaleFactor;
            xScale.current = mapScreenXToScale(screenOffset);
            const newScale = Math.min(xScale.current, yScale.current);
            scale.set(newScale);
            x.set(mapScreenToXOffset(screenOffset));
        };

        const updateY = (v: number) => {
            const screenOffset = v + yOffset + 20 * scaleFactor;
            yScale.current = mapScreenYToScale(screenOffset);
            const newScale = Math.min(xScale.current, yScale.current);
            scale.set(newScale);
            y.set(mapScreenToYOffset(screenOffset));
        };

        const unsubscribeX = planeX.on("change", updateX);
        const unsubscribeY = planeY.on("change", updateY);

        updateX(planeX.get());
        updateY(planeY.get());

        return () => {
            unsubscribeX();
            unsubscribeY();
        };
    }, [planeX, planeY, x, y, scale, xOffset, yOffset, device, icon, mapScreenToXOffset, mapScreenToYOffset, mapScreenXToScale, mapScreenYToScale, scaleFactor]);
}
