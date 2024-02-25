Moddable SDKをm5stack Core2 v1.1に対応させるためのファイルです

xs-devフォルダにこのリポジトリのコードを追加し、ビルドターゲットをesp32/m5stack_core2_11とすれば、動くはずです。ただし、2024/2/26現在、一度スタックちゃんが起動した後、何等か操作をし、2度目の起動を試した場合、m5stackが数秒で落ちるようになります。

※axp2101.jsは上書きされます。

もしm5stackが操作不能になったら、以下の手順でファームウェアを書き換えてください

①m5burnerを入手し、ファームウェアをダウンロードしておく

②core2をUSB接続し、リセットボタンを押しっぱなしにする(処理が進むと勝手に落ちてしまうため。もし落ちてしまったら、電源ボタンを押せば立ち上がります)

③m5burnerがcore2を認識している状態で書き込みを開始する。リセットボタンはまだ押しっぱなし

④m5burnerがcomポートへの接続を試み始めるタイミング(Connectingの文字が表示される)で、リセットボタンを離す




