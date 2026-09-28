# Shows one question as a card at the bottom-right and prints the answer:
#   "choice: <label>", "later" (answer in chat instead) or "timeout".
# Each option is "Label|what you would see". Changes no system setting.
param(
  [string]$Question = "Pick one",
  [string[]]$Options = @("Yes|do it", "No|leave it"),
  [int]$Recommended = 0,
  [string]$Because = "",
  [string]$Tag = "QUESTION",
  [int]$Seconds = 600,
  # Writes the card to a PNG and exits without showing it. For checking the look.
  [string]$RenderTo = ""
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ShowActivated="False"
        SizeToContent="Height" Width="440" ResizeMode="NoResize">
  <Border CornerRadius="14" Background="#1F1E1A" BorderBrush="#3A372F"
          BorderThickness="1" Margin="16" Padding="20,18,20,18">
    <Border.Effect>
      <DropShadowEffect BlurRadius="24" ShadowDepth="6" Opacity="0.45" Color="#000000"/>
    </Border.Effect>
    <StackPanel>
      <DockPanel LastChildFill="False">
        <Ellipse Width="8" Height="8" Fill="#D9955F" VerticalAlignment="Center" Margin="0,0,8,0"/>
        <TextBlock x:Name="TagText" FontFamily="Consolas" FontSize="11" Foreground="#A49D8F"
                   VerticalAlignment="Center"/>
        <TextBlock x:Name="Clock" DockPanel.Dock="Right" FontFamily="Consolas" FontSize="11"
                   Foreground="#A49D8F" VerticalAlignment="Center"/>
      </DockPanel>
      <TextBlock x:Name="QuestionText" FontFamily="Segoe UI Semibold" FontSize="17"
                 Foreground="#ECE7DC" TextWrapping="Wrap" Margin="0,12,0,4"/>
      <StackPanel x:Name="OptionList"/>
      <TextBlock x:Name="BecauseText" FontFamily="Segoe UI" FontSize="12" Foreground="#A49D8F"
                 TextWrapping="Wrap" Margin="0,12,0,0" LineHeight="18"/>
      <TextBlock x:Name="Later" Text="Answer in chat instead" HorizontalAlignment="Right"
                 FontFamily="Segoe UI" FontSize="12" Foreground="#D9955F" Cursor="Hand"
                 TextDecorations="Underline" Margin="0,12,0,0"/>
    </StackPanel>
  </Border>
</Window>
'@

$optionXaml = @'
<Button xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Margin="0,8,0,0" Cursor="Hand" HorizontalContentAlignment="Stretch">
  <Button.Template>
    <ControlTemplate TargetType="Button">
      <Border x:Name="B" CornerRadius="10" Background="#292722" BorderBrush="#3A372F"
              BorderThickness="1" Padding="14,10,14,10">
        <ContentPresenter HorizontalAlignment="Stretch"/>
      </Border>
      <ControlTemplate.Triggers>
        <Trigger Property="IsMouseOver" Value="True">
          <Setter TargetName="B" Property="Background" Value="#34312A"/>
          <Setter TargetName="B" Property="BorderBrush" Value="#D9955F"/>
        </Trigger>
      </ControlTemplate.Triggers>
    </ControlTemplate>
  </Button.Template>
  <StackPanel>
    <Grid>
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="Auto"/>
      </Grid.ColumnDefinitions>
      <TextBlock x:Name="Label" Grid.Column="0" FontFamily="Segoe UI Semibold" FontSize="14"
                 Foreground="#ECE7DC" TextWrapping="Wrap" VerticalAlignment="Center"/>
      <Border x:Name="Pick" Grid.Column="1" CornerRadius="9" Background="#33D9955F"
              Padding="9,2,9,3" Margin="10,0,0,0" VerticalAlignment="Center" Visibility="Collapsed">
        <TextBlock Text="Recommended" FontFamily="Segoe UI Semibold" FontSize="11"
                   Foreground="#E8AB7A"/>
      </Border>
    </Grid>
    <TextBlock x:Name="Detail" FontFamily="Segoe UI" FontSize="12.5" Foreground="#C9C3B5"
               TextWrapping="Wrap" Margin="0,3,0,0" LineHeight="18"/>
  </StackPanel>
</Button>
'@

$win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $xaml))
$win.FindName('TagText').Text = $Tag.ToUpper()
$win.FindName('Clock').Text = (Get-Date).ToString('HH:mm')
$win.FindName('QuestionText').Text = $Question
$reasonBlock = $win.FindName('BecauseText')
if ($Because) { $reasonBlock.Text = "Asked because: $Because" } else { $reasonBlock.Visibility = 'Collapsed' }

$script:result = 'timeout'
$list = $win.FindName('OptionList')
for ($i = 0; $i -lt $Options.Count; $i++) {
  $label, $detail = $Options[$i] -split '\|', 2
  $btn = [Windows.Markup.XamlReader]::Parse($optionXaml)
  $body = $btn.Content
  $body.FindName('Label').Text = $label
  $detailBlock = $body.FindName('Detail')
  if ($detail) { $detailBlock.Text = $detail } else { $detailBlock.Visibility = 'Collapsed' }
  if ($i -eq $Recommended) { $body.Children[0].FindName('Pick').Visibility = 'Visible' }
  $btn.Tag = $label
  $btn.Add_Click({ param($s, $e) $script:result = "choice: $($s.Tag)"; $win.Close() })
  [void]$list.Children.Add($btn)
}

$win.FindName('Later').Add_MouseLeftButtonUp({ $script:result = 'later'; $win.Close() })

$win.Add_Loaded({
  if ($RenderTo) { return }
  $area = [System.Windows.SystemParameters]::WorkArea
  $win.Left = $area.Right - $win.ActualWidth - 8
  $win.Top = $area.Bottom - $win.ActualHeight - 8
  $fade = New-Object System.Windows.Media.Animation.DoubleAnimation(0, 1, [TimeSpan]::FromMilliseconds(220))
  $win.BeginAnimation([System.Windows.Window]::OpacityProperty, $fade)
  [System.Media.SystemSounds]::Asterisk.Play()
})

$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds($Seconds)
$timer.Add_Tick({ $timer.Stop(); $win.Close() })
$timer.Start()

if ($RenderTo) {
  $win.ShowInTaskbar = $false; $win.Left = -5000; $win.Top = -5000; $win.Show()
  $win.UpdateLayout()
  $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap([int]($win.ActualWidth * 2), [int]($win.ActualHeight * 2), 192, 192, [System.Windows.Media.PixelFormats]::Pbgra32)
  $bmp.Render($win.Content)
  $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
  $fs = [System.IO.File]::Create($RenderTo); $enc.Save($fs); $fs.Close()
  $win.Close(); "rendered: $RenderTo"; return
}

[void]$win.ShowDialog()
$script:result
