import React from "react";

export default function PageHeader({ title, subtitle, actions }) {
    return (
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 stagger-in">
            <div>
                {subtitle && <div className="label-uppercase mb-2">{subtitle}</div>}
                <h1 className="font-display font-black tracking-tight text-3xl sm:text-4xl">{title}</h1>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
