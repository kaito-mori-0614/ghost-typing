# ghost-typing

`ghost-typing`は、別ブランチにある完成コードを薄いガイドとしてVS Code上に表示し、自分でそのコードを入力して再現するためのツールです。

LLMやOllamaは使いません。Git上のtarget branchを正解として使います。

## セットアップ

Node.js 20以上とVS Codeの`code`コマンドが使える状態で、このリポジトリをcloneします。

### 初回

```powershell
git clone https://github.com/kaito-mori-0614/ghost-typing.git
cd ghost-typing
npm.cmd install
npm.cmd run install:all
```

### 更新時

必ずGitHubの`main`へ更新してから再インストールします。

```powershell
cd D:\ghost-typing
git pull --ff-only origin main
npm.cmd install
npm.cmd run install:all
```

`install:all`は開始時に次を検査します。

- 現在branchが`main`
- working treeがclean
- `HEAD`と`origin/main`が完全一致

その後、CLIのlink、VSIX作成、VS Code拡張のインストール、version検証まで行います。

## 使い方

AIが完成コードを`ai-output`ブランチへcommit済みだとします。

AI実装前側のブランチへ移動して、次を実行します。

```powershell
ghost-typing.cmd ai-output
```

自動で次を行います。

1. 現在branchと`ai-output`のmerge-baseを探す
2. merge-baseから`ghost-typing/ai-output`を作る
3. そのbranchへswitchする

VS Codeは新しく起動しません。今開いているVS Codeをそのまま使います。

## VS Code上の動き

対象ファイルを開くと、`HEAD`とtarget branchのGit diffから、そのファイルで自分が入力する行を確定します。

### 削除は自動

base側にしかない旧コードは最初に自動で取り除きます。削除位置を探したり、取り消し線をBackspaceで追いかけたりする必要はありません。

### 入力箇所はファイル内に全部表示

target側で追加・変更された行は空の入力行にし、正解文字列をコメントのような薄いghost表示でファイル内に一度に表示します。

```text
通常コード
<薄いtarget行>
通常コード
<薄いtarget行>
<薄いtarget行>
```

入力した文字数だけghost表示が短くなり、正しく入力した文字は通常のVS Codeシンタックスハイライトになります。

VS CodeのInline Completion APIは使用しません。Ghost Typing自身の表示とCopilotのinline suggestionが同じproviderとして混ざる構成にはしていません。Ghost Typing中は表示更新時に現在のnative inline suggestionを閉じます。

### 間違い表示

入力済み文字はtargetの同じ位置と比較します。

間違った文字だけを次の2つで示します。

- VS CodeのError diagnosticによる赤い波線
- 薄い赤背景

文字色自体は変更しないため、Verilog/SystemVerilogなどのシンタックスハイライトは維持されます。

### Enter / Backspace / Delete

入力行にはtarget用の行が最初から用意されています。

- `Enter`: 現在行がtargetと完全一致したら次の未完了入力行へ移動
- `Enter`: 未完成・誤入力がある場合はその行に留まる
- `Backspace`: 行頭では前行と結合しない
- `Delete`: 行末では次行と結合しない

これにより、入力中に行構造がずれてghost表示位置が移動することを防ぎます。

## コマンド

次の未完了入力行へ移動します。

```text
ghost-typing: Go to Next Change
```

入力中に改行数を変えたなど、ファイル構造が崩れた場合は現在ファイルだけ入力開始状態へ戻せます。

```text
ghost-typing: Reset Current File
```

Resetするとそのファイルで入力した途中経過は失われます。

## 状態確認

```powershell
ghost-typing.cmd status
```

## commit

全ファイルをなぞり終え、保存した後に次を使います。

```powershell
ghost-typing.cmd commit "implement step2"
```

内部では現在のworking treeをstageしてtarget branchと比較します。完全一致していればcommitし、一致していなければcommitしません。

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
