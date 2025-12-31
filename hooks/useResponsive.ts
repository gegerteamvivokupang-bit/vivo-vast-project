'use client';

import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveState {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    deviceType: DeviceType;
    width: number;
}

const BREAKPOINTS = {
    mobile: 640,   // < 640px = mobile
    tablet: 1024,  // 640-1024px = tablet
    desktop: 1024, // > 1024px = desktop
};

export function useResponsive(): ResponsiveState {
    const [state, setState] = useState<ResponsiveState>({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        deviceType: 'mobile',
        width: 0,
    });

    useEffect(() => {
        const updateSize = () => {
            const width = window.innerWidth;
            const isMobile = width < BREAKPOINTS.mobile;
            const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.desktop;
            const isDesktop = width >= BREAKPOINTS.desktop;

            let deviceType: DeviceType = 'mobile';
            if (isDesktop) deviceType = 'desktop';
            else if (isTablet) deviceType = 'tablet';

            setState({ isMobile, isTablet, isDesktop, deviceType, width });
        };

        // Initial check
        updateSize();

        // Listen for resize
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    return state;
}

export default useResponsive;
