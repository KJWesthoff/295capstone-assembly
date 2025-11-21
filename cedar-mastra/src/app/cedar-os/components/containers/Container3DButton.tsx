import {
	useStyling,
	cn,
	createBorderColor,
	getShadedColor,
	getTextColorForBackground,
} from 'cedar-os';
import { HTMLMotionProps, motion } from 'motion/react';
import React from 'react';

interface Container3DButtonProps {
	children: React.ReactNode;
	/**
	 * Primary background colour for the button. Falls back to DEFAULT_COLOR from the styling slice.
	 */
	color?: string;
	/** Optional id forwarded to the underlying button */
	id?: string;
	/**
	 * Additional Tailwind classes to override/extend the defaults.
	 */
	className?: string;
	/**
	 * Additional Tailwind classes to apply to the child content wrapper.
	 */
	childClassName?: string;
	/** Inline styles to apply to the button element */
	style?: React.CSSProperties;
	/**
	 * Click handler for the button
	 */
	onClick?: () => void;
	/**
	 * Whether the button is disabled
	 */
	disabled?: boolean;
	/**
	 * Any additional props that should be forwarded directly to the underlying motion.button.
	 */
	motionProps?: HTMLMotionProps<'button'>;
}

const Container3DButton: React.FC<Container3DButtonProps> = ({
	children,
	className = '',
	childClassName = '',
	motionProps = {},
	id,
	style,
	color,
	onClick,
	disabled = false,
}) => {
	const { styling } = useStyling();

	const isDarkMode = styling.darkMode ?? false;
	// Determine base color for shading (use passed color or default black/white)
	const shadeBase = color || (isDarkMode ? '#000000' : '#ffffff');

	const restMotionProps = motionProps;

	// Static 3-D shadow styles – dynamically tinted by the passed color
	const baseStyle: React.CSSProperties = {
		boxShadow: isDarkMode
			? [
					`0px 2px 0px 0px ${getShadedColor(shadeBase, 80)}`,
					'-12px 18px 16px 0px rgba(0,0,0,0.4)',
					'-6px 10px 8px 0px rgba(0,0,0,0.4)',
					'-2px 4px 3px 0px rgba(0,0,0,0.3)',
					'-1px 2px 3px 0px rgba(255,255,255,0.05) inset',
			  ].join(', ')
			: [
					`0px 2px 0px 0px ${getShadedColor(shadeBase, 50)}`,
					'-12px 18px 16px 0px rgba(0,0,0,0.14)',
					'-6px 10px 8px 0px rgba(0,0,0,0.14)',
					'-2px 4px 3px 0px rgba(0,0,0,0.15)',
					'-1px 2px 3px 0px rgba(0,0,0,0.12) inset',
			  ].join(', '),
		willChange: 'transform, backdrop-filter',
		transform: 'translateZ(0)',
	};

	// Combine base style, color override, text color, and inline style from props
	const colorStyle: React.CSSProperties = color
		? { backgroundColor: color, borderColor: createBorderColor(color) }
		: {};
	const textStyle: React.CSSProperties = color
		? { color: getTextColorForBackground(color) }
		: {};
	const combinedStyle: React.CSSProperties = {
		...baseStyle,
		...colorStyle,
		...textStyle,
		...style,
	};

	return (
		<motion.button
			id={id}
			onClick={onClick}
			disabled={disabled}
			className={cn(
				'rounded-xl border-[3px] backdrop-blur-[12px] transition-all duration-200',
				'hover:scale-105 active:scale-95',
				'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
				// Only apply default border/background when no custom color provided
				!color &&
					(isDarkMode
						? 'border-gray-700 bg-black/40'
						: 'border-white bg-[#FAF9F580]'),
				className
			)}
			style={combinedStyle}
			whileHover={{ scale: disabled ? 1 : 1.05 }}
			whileTap={{ scale: disabled ? 1 : 0.95 }}
			{...restMotionProps}>
			<div className={cn('w-full h-full', childClassName)}>
				{children}
			</div>
		</motion.button>
	);
};

export default Container3DButton;