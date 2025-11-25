import { cn, useStyling, getShadedColor, getLightenedColor } from 'cedar-os';
import { HTMLMotionProps, motion } from 'motion/react';
import React from 'react';

interface Flat3dButtonProps extends Omit<HTMLMotionProps<'button'>, 'onDrag'> {
	children: React.ReactNode;
	/**
	 * Whether to force dark theme styling. Otherwise derives from Cedar styling store when available.
	 */
	isDarkTheme?: boolean;
	/**
	 * Optional primary colour used to tint shadows/highlights.
	 */
	primaryColor?: string;
	className?: string;
	layoutId?: string;
	/**
	 * Click handler for the button
	 */
	onClick?: () => void;
	/**
	 * Whether the button is disabled
	 */
	disabled?: boolean;
}

const Flat3dButton: React.FC<Flat3dButtonProps> = ({
	children,
	isDarkTheme = false,
	primaryColor,
	className = '',
	layoutId,
	style,
	onClick,
	disabled = false,
	...props
}) => {
	// Pull dark mode preference from Cedar styling slice
	const { styling } = useStyling();

	// Resolve whether dark theme should be applied
	const darkThemeEnabled = isDarkTheme || styling.darkMode;

	// ------------------------------------------------------------------
	// Background + edge shadow configuration
	// ------------------------------------------------------------------
	// If a primaryColor is provided, derive a custom gradient + shadow.
	// Otherwise fall back to the theme-based defaults.
	let backgroundStyle: React.CSSProperties;
	let edgeShadow: string;

	if (primaryColor) {
		// Derive a lighter and darker tint from the primary colour for the gradient.
		const light = getLightenedColor(primaryColor, 40);
		const dark = getShadedColor(primaryColor, 40);
		backgroundStyle = {
			background: `linear-gradient(to bottom, ${light}, ${dark})`,
		};
		// Create a subtle edge shadow using a darker shade of the primary colour.
		edgeShadow = `0px 1px 0px 0px ${getShadedColor(
			primaryColor,
			30
		)}, 0 4px 6px 0 rgba(0,0,0,0.20)`;
	} else {
		// Theme-based defaults
		backgroundStyle = darkThemeEnabled
			? {
					background: `linear-gradient(to bottom, rgb(38,38,38), rgb(20,20,20))`,
			  }
			: {
					background: `linear-gradient(to bottom, #FAFAFA, #F0F0F0)`,
			  };

		edgeShadow = darkThemeEnabled
			? `0px 1px 0px 0px ${getShadedColor(
					'#000000',
					20
			  )}, 0 4px 6px 0 rgba(0,0,0,0.20)`
			: `0px 1px 0px 0px ${getShadedColor(
					'#ffffff',
					30
			  )}, 0 4px 6px 0 rgba(0,0,0,0.35)`;
	}

	return (
		<motion.button
			layoutId={layoutId}
			onClick={onClick}
			disabled={disabled}
			className={cn(
				'rounded-lg w-full transition-all duration-200',
				'hover:scale-105 active:scale-95',
				'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
				className
			)}
			style={{
				boxShadow: `${edgeShadow}`,
				willChange: 'box-shadow, transform',
				...backgroundStyle,
				...style,
			}}
			whileHover={{ scale: disabled ? 1 : 1.05 }}
			whileTap={{ scale: disabled ? 1 : 0.95 }}
			{...props}>
			{children}
		</motion.button>
	);
};

export default Flat3dButton;