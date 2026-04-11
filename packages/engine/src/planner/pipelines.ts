import type { PipelineDefinition } from "@muxory/shared";

export const curatedPipelines: PipelineDefinition[] = [
  {
    id: "markdown-to-pdf-via-docx",
    route: {
      kind: "conversion",
      from: "markdown",
      to: "pdf"
    },
    quality: "medium",
    steps: [
      {
        pluginId: "pandoc",
        from: "markdown",
        to: "docx"
      },
      {
        pluginId: "libreoffice",
        from: "docx",
        to: "pdf"
      }
    ]
  },
  {
    id: "html-to-pdf-via-docx",
    route: {
      kind: "conversion",
      from: "html",
      to: "pdf"
    },
    quality: "medium",
    steps: [
      {
        pluginId: "pandoc",
        from: "html",
        to: "docx"
      },
      {
        pluginId: "libreoffice",
        from: "docx",
        to: "pdf"
      }
    ]
  },
  {
    id: "docx-to-markdown-via-pdf",
    route: {
      kind: "conversion",
      from: "docx",
      to: "markdown"
    },
    quality: "medium",
    steps: [
      {
        pluginId: "libreoffice",
        from: "docx",
        to: "pdf"
      },
      {
        pluginId: "markitdown",
        from: "pdf",
        to: "markdown"
      }
    ]
  },
  {
    id: "pdf-to-txt-via-markdown",
    route: {
      kind: "conversion",
      from: "pdf",
      to: "txt"
    },
    quality: "medium",
    steps: [
      {
        pluginId: "markitdown",
        from: "pdf",
        to: "markdown"
      },
      {
        pluginId: "pandoc",
        from: "markdown",
        to: "txt"
      }
    ]
  }
];
