declare module 'lottie-react' {
    import React from 'react';

    export interface LottieProps {
        animationData?: any;
        src?: string | object;
        loop?: boolean | number;
        autoplay?: boolean;
        style?: React.CSSProperties;
        className?: string;
        lottieRef?: any;
        onComplete?: (event?: any) => void;
        renderer?: 'svg' | 'canvas' | 'html';
        [key: string]: any;
    }

    export const Lottie: React.FC<LottieProps>;
    export default Lottie;

    export function useLottie(options: any): any;
}
