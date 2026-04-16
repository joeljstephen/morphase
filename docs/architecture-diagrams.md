# Morphase Architecture Diagrams

## High-Level System Overview

```mermaid
graph TB
    User((User))

    subgraph "Entry Points"
        CLI["CLI<br/>Commander + Interactive Wizard"]
    end

    subgraph "Morphase Engine"
        Engine["MorphaseEngine<br/>Async factory entry point"]

        subgraph "Request Pipeline"
            Normalize["normalizeRequest<br/>Infer types, resolve paths, identify route"]
            Plan["Planner<br/>Score candidates, select plugin or pipeline"]
            Exec["Executor<br/>Run plan via execa, validate outputs"]
        end

        subgraph "Supporting Services"
            Registry["PluginRegistry<br/>Query & match plugins to routes"]
            JobMgr["JobManager<br/>In-memory job lifecycle tracking"]
            Logger["Logger<br/>Structured prefixed logging"]
            Doctor["Doctor<br/>Backend health inspection"]
            Platform["Platform<br/>OS & package manager detection"]
            Config["Config<br/>~/.morphase/config.json"]
        end

        Pipelines["Curated Pipelines<br/>Multi-step conversion chains"]
    end

    subgraph "Plugin Layer (14 backends)"
        direction TB
        Pandoc["pandoc"]
        LO["libreoffice"]
        FFmpeg["ffmpeg"]
        IM["imagemagick"]
        QPDF["qpdf"]
        Traf["trafilatura"]
        YT["ytdlp"]
        MD["markitdown"]
        Whisper["whisper"]
        Summ["summarize"]
        Jpeg["jpegoptim"]
        Opti["optipng"]
        I2P["img2pdf"]
        Pop["poppler"]
    end

    subgraph "External Tools (system-installed)"
        ExtPandoc["pandoc binary"]
        ExtLO["soffice binary"]
        ExtFFmpeg["ffmpeg binary"]
        ExtIM["magick binary"]
        ExtQPDF["qpdf binary"]
        ExtTraf["trafilatura binary"]
        ExtYT["yt-dlp binary"]
        ExtMD["markitdown binary"]
        ExtWhisper["whisper binary"]
        ExtSum["summarize binary"]
        ExtJpeg["jpegoptim binary"]
        ExtOpti["optipng binary"]
        ExtI2P["img2pdf binary"]
        ExtPop["pdftocairo / pdfimages"]
    end

    CLI --> Engine
    User --> CLI

    Engine --> Config
    Engine --> Registry
    Engine --> JobMgr
    Engine --> Logger
    Engine --> Doctor
    Engine --> Platform

    Engine --> Normalize
    Normalize --> Plan
    Plan --> Exec

    Plan --> Registry
    Plan --> Pipelines

    Registry --> Pandoc & LO & FFmpeg & IM & QPDF & Traf & YT & MD & Whisper & Summ & Jpeg & Opti & I2P & Pop

    Pandoc -.-> ExtPandoc
    LO -.-> ExtLO
    FFmpeg -.-> ExtFFmpeg
    IM -.-> ExtIM
    QPDF -.-> ExtQPDF
    Traf -.-> ExtTraf
    YT -.-> ExtYT
    MD -.-> ExtMD
    Whisper -.-> ExtWhisper
    Summ -.-> ExtSum
    Jpeg -.-> ExtJpeg
    Opti -.-> ExtOpti
    I2P -.-> ExtI2P
    Pop -.-> ExtPop

    style CLI fill:#4A90D9,color:#fff
    style Engine fill:#E8833A,color:#fff
    style Normalize fill:#F5C842,color:#333
    style Plan fill:#F5C842,color:#333
    style Exec fill:#F5C842,color:#333
    style Registry fill:#7B68EE,color:#fff
    style JobMgr fill:#7B68EE,color:#fff
    style Logger fill:#7B68EE,color:#fff
    style Doctor fill:#7B68EE,color:#fff
    style Platform fill:#7B68EE,color:#fff
    style Config fill:#7B68EE,color:#fff
    style Pipelines fill:#7B68EE,color:#fff
```

## Request Lifecycle (Sequence)

```mermaid
sequenceDiagram
    participant User
    participant CLI as CLI
    participant Engine as MorphaseEngine
    participant Norm as normalizeRequest
    participant Planner as Planner
    participant Registry as PluginRegistry
    participant Pipelines as Curated Pipelines
    participant Executor as Executor
    participant Plugin as Selected Plugin
    participant Tool as External Tool

    User->>CLI: morphase convert input.pptx output.pdf
    CLI->>Engine: submit(JobRequest)
    Engine->>Norm: normalizeRequest(request)
    Norm-->>Engine: Normalized route (pptx -> pdf)

    Engine->>Planner: plan(PlanRequest)
    Planner->>Registry: findCandidates(route, platform)

    alt Direct plugin match found
        Registry-->>Planner: Matching plugins with capabilities
        Planner->>Planner: Score and rank candidates
        Planner->>Plugin: plan(PlanRequest)
        Plugin-->>Planner: ExecutionPlan
    else No direct match
        Planner->>Pipelines: Find matching multi-step pipeline
        Pipelines-->>Planner: Pipeline steps
        Planner->>Plugin: plan each step sequentially
    end

    Planner-->>Engine: PlannedExecution
    Engine->>Executor: run(jobId, PlannedExecution)

    loop For each step
        Executor->>Tool: execa(command, args)
        Tool-->>Executor: stdout, stderr, exit code
        Executor->>Executor: Apply outputMapping, collect outputs
    end

    Executor->>Executor: Validate outputs, cleanup temp dirs
    Executor-->>Engine: JobResult
    Engine-->>CLI: JobResult
    CLI-->>User: Formatted output
```

## Monorepo Package Dependencies

```mermaid
graph TD
    Shared["@morphase/shared<br/>Types, schemas, constants, utils"]
    SDK["@morphase/plugin-sdk<br/>definePlugin, detect helpers"]
    Plugins["@morphase/plugins<br/>14 builtin backend plugins"]
    Engine["@morphase/engine<br/>Planner, executor, registry, doctor"]
    CLI["morphase<br/>Commander + prompts"]

    SDK --> Shared
    Plugins --> Shared
    Plugins --> SDK
    Engine --> Shared
    Engine --> SDK
    Engine --> Plugins
    CLI --> Engine
    CLI --> Shared

    style Shared fill:#50C878,color:#fff
    style SDK fill:#9B59B6,color:#fff
    style Plugins fill:#E74C3C,color:#fff
    style Engine fill:#E8833A,color:#fff
    style CLI fill:#4A90D9,color:#fff
```

## Plugin Interface

```mermaid
classDiagram
    class MorphasePlugin {
        <<interface>>
        +id: string
        +name: string
        +priority: number
        +minimumVersion?: string
        +optional?: boolean
        +commonProblems?: string[]
        +capabilities(): Capability[]
        +detect(platform): Promise~DetectionResult~
        +verify(platform): Promise~VerificationResult~
        +getInstallHints(platform): InstallHint[]
        +getUpdateHints(platform): InstallHint[]
        +plan(request): Promise~ExecutionPlan | null~
        +explain(request): Promise~string~
    }

    class PluginSDK {
        <<@morphase/plugin-sdk>>
        +definePlugin(plugin): MorphasePlugin
        +detectFirstAvailableCommand(cmds, args): Promise~DetectionResult~
        +installHintByPlatform(platform, hints): InstallHint[]
    }

    class PandocPlugin { id = "pandoc" }
    class LibreOfficePlugin { id = "libreoffice" }
    class FFmpegPlugin { id = "ffmpeg" }
    class ImageMagickPlugin { id = "imagemagick" }
    class QPDFPlugin { id = "qpdf" }
    class TrafilaturaPlugin { id = "trafilatura" }
    class YTDLPPlugin { id = "ytdlp" }
    class MarkItDownPlugin { id = "markitdown" }
    class WhisperPlugin { id = "whisper" }
    class SummarizePlugin { id = "summarize" }
    class JpegoptimPlugin { id = "jpegoptim" }
    class OptipngPlugin { id = "optipng" }
    class Img2PdfPlugin { id = "img2pdf" }
    class PopplerPlugin { id = "poppler" }

    PluginSDK ..> MorphasePlugin : creates via definePlugin

    MorphasePlugin <|.. PandocPlugin
    MorphasePlugin <|.. LibreOfficePlugin
    MorphasePlugin <|.. FFmpegPlugin
    MorphasePlugin <|.. ImageMagickPlugin
    MorphasePlugin <|.. QPDFPlugin
    MorphasePlugin <|.. TrafilaturaPlugin
    MorphasePlugin <|.. YTDLPPlugin
    MorphasePlugin <|.. MarkItDownPlugin
    MorphasePlugin <|.. WhisperPlugin
    MorphasePlugin <|.. SummarizePlugin
    MorphasePlugin <|.. JpegoptimPlugin
    MorphasePlugin <|.. OptipngPlugin
    MorphasePlugin <|.. Img2PdfPlugin
    MorphasePlugin <|.. PopplerPlugin
```

## Candidate Scoring & Planning

```mermaid
flowchart TD
    Start([Planner.plan called]) --> FindCandidates["Registry.findCandidates(route, platform)"]
    FindCandidates --> HasCandidates{Any candidates?}

    HasCandidates -->|No| TryPipeline1["Try curated pipelines"]
    TryPipeline1 --> PipelineMatch1{Pipeline found?}
    PipelineMatch1 -->|Yes| PipelinePlan["Build multi-step plan"]
    PipelineMatch1 -->|No| Unsupported["Throw UNSUPPORTED_ROUTE"]

    HasCandidates -->|Yes| Evaluate["For each candidate:<br/>detect() + verify()"]
    Evaluate --> Score["Score each candidate<br/>(base 50 + bonuses/penalties)"]
    Score --> Rank["Sort by score descending"]
    Rank --> HasInstalled{Any installed?}

    HasInstalled -->|No| ReturnInstall["Return installNeeded: true"]
    HasInstalled -->|Yes| TryPlans["For each installed candidate (rank order):<br/>plugin.plan(request)"]

    TryPlans --> PlanResult{Plan produced?}
    PlanResult -->|Yes| ReturnPlan["Return PlannedExecution"]
    PlanResult -->|No, try next| TryPlans
    PlanResult -->|All null| TryPipeline2["Try curated pipelines"]
    TryPipeline2 --> PipelineMatch2{Pipeline found?}
    PipelineMatch2 -->|Yes| PipelinePlan
    PipelineMatch2 -->|No| Unsupported

    style Start fill:#4A90D9,color:#fff
    style ReturnPlan fill:#50C878,color:#fff
    style ReturnInstall fill:#F5C842,color:#333
    style Unsupported fill:#E74C3C,color:#fff
    style PipelinePlan fill:#9B59B6,color:#fff
```

## Multi-Step Pipelines

```mermaid
graph LR
    subgraph "Pipeline: markdown-to-pdf-via-docx"
        A1["Markdown"] -->|"pandoc"| A2["DOCX"]
        A2 -->|"libreoffice"| A3["PDF"]
    end

    subgraph "Pipeline: html-to-pdf-via-docx"
        B1["HTML"] -->|"pandoc"| B2["DOCX"]
        B2 -->|"libreoffice"| B3["PDF"]
    end

    subgraph "Pipeline: docx-to-markdown-via-pdf"
        C1["DOCX"] -->|"libreoffice"| C2["PDF"]
        C2 -->|"markitdown"| C3["Markdown"]
    end

    subgraph "Pipeline: pdf-to-txt-via-markdown"
        D1["PDF"] -->|"markitdown"| D2["Markdown"]
        D2 -->|"pandoc"| D3["TXT"]
    end

    style A1 fill:#E8833A,color:#fff
    style A3 fill:#50C878,color:#fff
    style B1 fill:#E8833A,color:#fff
    style B3 fill:#50C878,color:#fff
    style C1 fill:#E8833A,color:#fff
    style C3 fill:#50C878,color:#fff
    style D1 fill:#E8833A,color:#fff
    style D3 fill:#50C878,color:#fff
```

## CLI Command Tree

```mermaid
graph LR
    Root["morphase"]

    Root --> Wizard["(no args)<br/>Interactive Wizard"]
    Root --> Convert["convert [args...]<br/>File conversion"]
    Root --> Extract["extract &lt;input&gt; --to<br/>Content extraction"]
    Root --> Fetch["fetch &lt;url&gt; --to<br/>URL download"]
    Root --> Media["media &lt;input&gt; --to<br/>Audio/video"]
    Root --> Image["image"]
    Root --> Video["video"]
    Root --> PDF["pdf"]
    Root --> Doctor["doctor<br/>Health check"]
    Root --> Backend["backend"]
    Root --> Explain["explain &lt;input&gt; --to<br/>Preview plan"]

    Image --> ImgCompress["compress &lt;input&gt;"]
    Video --> VidCompress["compress &lt;input&gt;"]

    PDF --> Merge["merge &lt;inputs...&gt;"]
    PDF --> Split["split &lt;input&gt; --pages"]
    PDF --> Optimize["optimize &lt;input&gt;"]
    PDF --> ExtractImg["extract-images &lt;input&gt;"]

    Backend --> BList["list"]
    Backend --> BStatus["status"]
    Backend --> BVerify["verify &lt;id&gt;"]
    Backend --> BInstall["install &lt;id&gt;"]
    Backend --> BUpdate["update &lt;id&gt;"]

    style Root fill:#E8833A,color:#fff
    style Wizard fill:#9B59B6,color:#fff
    style Convert fill:#4A90D9,color:#fff
    style Extract fill:#4A90D9,color:#fff
    style Fetch fill:#4A90D9,color:#fff
    style Media fill:#4A90D9,color:#fff
    style Doctor fill:#50C878,color:#fff
    style Explain fill:#50C878,color:#fff
```
