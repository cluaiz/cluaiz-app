import React from 'react';
import WakeSlider from '../../WakeSlider/WakeSlider';

export interface ElasticSliderProps {
    min: number;
    max: number;
    step?: number;
    value: number;
    onChange: (value: number) => void;
    className?: string;
    height?: number;
    bars?: number;
}

export const ElasticSlider: React.FC<ElasticSliderProps> = ({
    min,
    max,
    step = 1,
    value,
    onChange,
    className = '',
    height = 36,
    bars = 36
}) => {
    return (
        <div className={`w-full py-1 ${className}`}>
            <WakeSlider
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={onChange}
                height={height}
                restHeight={8}
                gap={3}
                bars={bars}
                fillColor="var(--accent-color)"
                trackColor="color-mix(in srgb, var(--border-color) 60%, rgba(255,255,255,0.08))"
                crestColor="color-mix(in srgb, var(--accent-color) 75%, white)"
            />
        </div>
    );
};

export default ElasticSlider;
