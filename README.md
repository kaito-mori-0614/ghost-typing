# ghost-typing

`ghost-typing`は、別ブランチにある完成コードをVS Codeのghost textとして表示し、自分でそのコードを入力して再現するためのツールです。

LLMやOllamaは使いません。Git上のtarget branchを正解として使います。

## 1回だけのセットアップ

Node.js 20以上とVS Codeの`code`コマンドが使える状態で、このリポジトリをcloneします。

### PowerShell

```powershell
git clone https://github.com/kaito-mori-0614/ghost-typing.git
cd ghost-typing
npm.cmd install
npm.cmd run install:all
```

`install:all`は次の2つを行います。

- `ghost-typing` CLIをグローバルにlink
- VS Code拡張を`.vsix`化してインストール

以後、別のGitリポジトリでも`ghost-typing`コマンドを使えます。

## 使い方

AIが完成コードを`ai-output`ブランチへcommit済みだとします。

AI実装前側のブランチへ移動して、次を実行します。

```powershell
ghost-typing ai-output
```

自動で次を行います。

1. 現在branchと`ai-output`のmerge-baseを探す
2. merge-baseから`ghost-typing/ai-output`を作る
3. そのbranchへswitchする

VS Codeは新しく起動しません。今開いているVS Codeをそのまま使います。

VS Code拡張は現在branch名からtargetを自動判定します。設定ファイルやセッション状態はありません。

対象ファイルを開くと最初の差分へ移動します。

- 追加箇所: ghost textとして表示
- 置換箇所: 消すべき既存コードを薄い取り消し線で表示。消すと置換後コードがghost textになる
- 新規ファイル: 空ファイルを自動作成し、target内容をghost textとして表示

一度に扱うのは最初の小さな差分だけです。入力に合わせて次のghost textへ進みます。

必要ならCommand Paletteから次も実行できます。

```text
ghost-typing: Go to Next Change
```

## 状態確認

```powershell
ghost-typing status
```

## commit

全部なぞり終えたら、次を使います。

```powershell
ghost-typing commit "implement step2"
```

内部では現在のworking treeをstageしてtarget branchと比較します。
完全一致していればcommitし、一致していなければcommitしません。

## branch構成

```text
                 C---D  ai-output
                /
A---B-----------+
                \
                 G     ghost-typing/ai-output
```

`B`がmerge-baseです。

`ghost-typing/ai-output`は`B`から作成され、自分のタイピングで最終的に`ai-output`と同じファイル内容へ到達します。

## 方針

意図的に入れていません。

- Ollama / LLM
- Prompt
- WebView
- 進捗率
- Trace Ledger
- セッションJSON
- Tab/Paste禁止
- VS Codeの新規Window起動制御

現在のコードとtarget branchだけを使います。
