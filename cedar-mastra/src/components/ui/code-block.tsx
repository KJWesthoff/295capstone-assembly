"use client";

import * as React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
    language: string;
    value: string;
    className?: string;
}

export function CodeBlock({ language, value, className }: CodeBlockProps) {
    return (
        <div className={cn("rounded-md border border-border overflow-hidden", className)}>
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: "12px",
                    lineHeight: "1.5",
                    padding: "1rem",
                }}
                showLineNumbers={true}
                lineNumberStyle={{
                    minWidth: "2em",
                    paddingRight: "1em",
                    color: "#6e7681",
                    textAlign: "right",
                }}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
}
