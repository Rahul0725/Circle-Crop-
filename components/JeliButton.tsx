
import React from 'react';

interface JeliButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export const JeliButton: React.FC<JeliButtonProps> = ({ 
  variant = 'primary', 
  children, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-6 py-4 rounded-[2rem] font-bold transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 select-none";
  
  const variants = {
    primary: "jeli-gradient text-white jeli-shadow hover:brightness-105",
    secondary: "bg-white/60 text-slate-800 hover:bg-white/80 border border-white/40 backdrop-blur-md",
    ghost: "bg-transparent text-slate-600 hover:bg-black/5"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
