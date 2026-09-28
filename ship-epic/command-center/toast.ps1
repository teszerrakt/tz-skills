# Shows one toast at the bottom-right from a JSON spec and prints what happened:
#   question: "choice: <label>", "text: <words>", "open", "later" or "timeout"
#   stop, good, waiting: "open", "later" or "timeout"
# Changes no system setting.
param(
  [Parameter(Mandatory = $true)][string]$Spec,
  # Writes the toast to a PNG and exits without showing it. For checking the look.
  [string]$RenderTo = ""
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase
$s = Get-Content -Raw -Encoding UTF8 -LiteralPath $Spec | ConvertFrom-Json

$signal = @{ question = '#F5A623'; waiting = '#F5A623'; stop = '#FF6166'; good = '#45D483' }[[string]$s.kind]
if (-not $signal) { $signal = '#8F8F8F' }
$small = $s.kind -eq 'good' -or $s.kind -eq 'waiting'
$ring = 'M12,3 A9,9 0 1 1 11.99,3 Z '
$shape = @{
  question = $ring + 'M9.5,9.5 A2.5,2.5 0 1 1 13,11.8 C12.3,12.2 12,12.7 12,13.5 M12,17 L12.01,17'
  waiting  = $ring + 'M9.5,9.5 A2.5,2.5 0 1 1 13,11.8 C12.3,12.2 12,12.7 12,13.5 M12,17 L12.01,17'
  stop     = 'M12,4 L21,20 L3,20 Z M12,10 L12,14 M12,17 L12.01,17'
  good     = $ring + 'M8,12.5 L10.5,15 L16,9.5'
}[[string]$s.kind]
if (-not $shape) { $shape = $ring }

[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ShowActivated="False"
        SizeToContent="Height" Width="452" ResizeMode="NoResize"
        FontFamily="Geist, Segoe UI" TextOptions.TextFormattingMode="Display">
  <Window.Resources>
    <Style x:Key="Flat" TargetType="Button">
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Foreground" Value="#EDEDED"/>
      <Setter Property="FontSize" Value="14"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="B" CornerRadius="6" Background="{TemplateBinding Background}"
                    BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter VerticalAlignment="Center" HorizontalAlignment="{TemplateBinding HorizontalContentAlignment}"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="B" Property="Opacity" Value="0.82"/>
              </Trigger>
              <Trigger Property="IsKeyboardFocused" Value="True">
                <Setter TargetName="B" Property="BorderBrush" Value="#52A8FF"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>
  <Border CornerRadius="12" Background="#0A0A0A" BorderBrush="#2A2A2A" BorderThickness="1" Margin="18">
    <Border.Effect>
      <DropShadowEffect BlurRadius="28" ShadowDepth="8" Opacity="0.55" Color="#000000"/>
    </Border.Effect>
    <StackPanel>
      <Border x:Name="Line" Height="2" Margin="12,0,12,0" CornerRadius="1"/>
      <StackPanel Margin="18,14,18,16">
        <DockPanel x:Name="Head" LastChildFill="False">
          <Viewbox Width="16" Height="16" VerticalAlignment="Center" Margin="0,0,8,0">
            <Canvas Width="24" Height="24">
              <Path x:Name="Dot" StrokeThickness="1.7" StrokeStartLineCap="Round" StrokeEndLineCap="Round" StrokeLineJoin="Round"/>
            </Canvas>
          </Viewbox>
          <TextBlock x:Name="TagText" FontFamily="Geist Mono, Consolas" FontSize="12" Foreground="#EDEDED" VerticalAlignment="Center"/>
          <TextBlock x:Name="StateText" FontFamily="Geist Mono, Consolas" FontSize="12" Foreground="#8F8F8F" VerticalAlignment="Center" Margin="8,0,0,0"/>
          <Button x:Name="Hide" DockPanel.Dock="Right" Style="{StaticResource Flat}" Width="28" Height="28" Margin="6,-6,-8,-6"
                  Background="Transparent" BorderThickness="1" BorderBrush="Transparent" ToolTip="Hide for now"
                  HorizontalContentAlignment="Center">
            <Path Data="M0,0 L8,8 M8,0 L0,8" Stroke="#8F8F8F" StrokeThickness="1.4" StrokeStartLineCap="Round" StrokeEndLineCap="Round"/>
          </Button>
          <TextBlock x:Name="Clock" DockPanel.Dock="Right" FontFamily="Geist Mono, Consolas" FontSize="12" Foreground="#8F8F8F" VerticalAlignment="Center"/>
        </DockPanel>
        <TextBlock x:Name="Title" FontSize="17" FontWeight="SemiBold" Foreground="#EDEDED" TextWrapping="Wrap" Margin="0,12,0,0" LineHeight="23"/>
        <TextBlock x:Name="Body" FontSize="13.5" Foreground="#A1A1A1" TextWrapping="Wrap" Margin="0,6,0,0" LineHeight="20"/>
        <StackPanel x:Name="OptionList" Margin="0,6,0,0"/>
        <Grid x:Name="FreeRow" Margin="0,8,0,0" Height="40">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="Auto"/>
          </Grid.ColumnDefinitions>
          <Border x:Name="FreeBox" CornerRadius="6" Background="#000000" BorderBrush="#2A2A2A" BorderThickness="1">
            <Grid>
              <TextBlock x:Name="FreeHint" Text="Or type your own answer" FontSize="14" Foreground="#8F8F8F"
                         VerticalAlignment="Center" Margin="12,0,12,0" IsHitTestVisible="False"/>
              <TextBox x:Name="Free" Background="Transparent" BorderThickness="0" Foreground="#EDEDED" CaretBrush="#EDEDED"
                       FontSize="14" VerticalContentAlignment="Center" Padding="10,0,10,0"/>
            </Grid>
          </Border>
          <Button x:Name="Send" Grid.Column="1" Style="{StaticResource Flat}" Content="Send" Margin="6,0,0,0" Padding="14,0,14,0"
                  Background="#EDEDED" Foreground="#0A0A0A" FontWeight="SemiBold" BorderThickness="1" BorderBrush="#EDEDED"/>
        </Grid>
        <TextBlock x:Name="Because" FontSize="12.5" Foreground="#8F8F8F" TextWrapping="Wrap" Margin="0,12,0,0" LineHeight="19"/>
        <StackPanel x:Name="Actions" Orientation="Horizontal" Margin="0,14,0,0">
          <Button x:Name="Primary" Style="{StaticResource Flat}" Height="40" Padding="14,0,14,0" Background="#EDEDED" Foreground="#0A0A0A"
                  FontWeight="SemiBold" BorderThickness="1" BorderBrush="#EDEDED"/>
          <Button x:Name="Later" Style="{StaticResource Flat}" Content="Later" Height="40" Padding="14,0,14,0" Margin="6,0,0,0"
                  Background="Transparent" BorderThickness="1" BorderBrush="#2A2A2A"/>
        </StackPanel>
        <Border x:Name="Foot" BorderBrush="#2A2A2A" BorderThickness="0,1,0,0" Margin="0,14,0,0" Padding="0,10,0,0">
          <DockPanel LastChildFill="False">
            <TextBlock x:Name="OpenLink" Text="Open in command center" FontSize="13" Foreground="#52A8FF" Cursor="Hand" VerticalAlignment="Center"/>
            <TextBlock x:Name="More" DockPanel.Dock="Right" FontFamily="Geist Mono, Consolas" FontSize="12" Foreground="#8F8F8F" VerticalAlignment="Center"/>
          </DockPanel>
        </Border>
      </StackPanel>
    </StackPanel>
  </Border>
</Window>
'@

$optionXaml = @'
<Button xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Margin="0,6,0,0" Cursor="Hand" HorizontalContentAlignment="Stretch" MinHeight="42">
  <Button.Template>
    <ControlTemplate TargetType="Button">
      <Border x:Name="B" CornerRadius="6" Background="#111111" BorderBrush="{TemplateBinding BorderBrush}"
              BorderThickness="1" Padding="12,8,12,8">
        <ContentPresenter HorizontalAlignment="Stretch" VerticalAlignment="Center"/>
      </Border>
      <ControlTemplate.Triggers>
        <Trigger Property="IsMouseOver" Value="True">
          <Setter TargetName="B" Property="Background" Value="#1A1A1A"/>
          <Setter TargetName="B" Property="BorderBrush" Value="#EDEDED"/>
        </Trigger>
        <Trigger Property="IsKeyboardFocused" Value="True">
          <Setter TargetName="B" Property="BorderBrush" Value="#52A8FF"/>
        </Trigger>
      </ControlTemplate.Triggers>
    </ControlTemplate>
  </Button.Template>
  <Grid>
    <Grid.ColumnDefinitions>
      <ColumnDefinition Width="Auto"/>
      <ColumnDefinition Width="*"/>
      <ColumnDefinition Width="Auto"/>
    </Grid.ColumnDefinitions>
    <Border Grid.Column="0" CornerRadius="4" BorderBrush="#2A2A2A" BorderThickness="1" Padding="6,1,6,1"
            Margin="0,0,10,0" VerticalAlignment="Center">
      <TextBlock x:Name="Key" FontFamily="Geist Mono, Consolas" FontSize="11" Foreground="#8F8F8F"/>
    </Border>
    <StackPanel Grid.Column="1" VerticalAlignment="Center">
      <TextBlock x:Name="Label" FontSize="14" FontWeight="Medium" Foreground="#EDEDED" TextWrapping="Wrap"/>
      <TextBlock x:Name="Detail" FontSize="12.5" Foreground="#A1A1A1" TextWrapping="Wrap" Margin="0,2,0,0"/>
    </StackPanel>
    <Border x:Name="Pick" Grid.Column="2" CornerRadius="9" Background="#0A1F38" Padding="9,2,9,3"
            Margin="10,0,0,0" VerticalAlignment="Center" Visibility="Collapsed">
      <TextBlock Text="Recommended" FontSize="11" FontWeight="SemiBold" Foreground="#52A8FF"/>
    </Border>
  </Grid>
</Button>
'@

$win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $xaml))
$brush = New-Object System.Windows.Media.BrushConverter
function Part($name) { $win.FindName($name) }
function Gone($name) { (Part $name).Visibility = 'Collapsed' }

$script:result = 'timeout'
function Finish($value) { $script:result = $value; $win.Close() }

(Part 'Dot').Stroke = $brush.ConvertFromString($signal)
(Part 'Dot').Data = [System.Windows.Media.Geometry]::Parse($shape)
(Part 'Line').Background = $brush.ConvertFromString($signal)
(Part 'TagText').Text = [string]$s.tag
(Part 'StateText').Text = [string]$s.state
(Part 'Clock').Text = [string]$s.time
(Part 'Title').Text = [string]$s.title
if ($s.body) { (Part 'Body').Text = [string]$s.body } else { Gone 'Body' }
if ($s.because) { (Part 'Because').Text = "Asked because: $($s.because)" } else { Gone 'Because' }
if ($s.more -gt 0) { (Part 'More').Text = "$($s.more) more waiting" }

$picks = @()
if ($s.kind -eq 'question') {
  Gone 'Actions'
  $list = Part 'OptionList'
  $i = 0
  foreach ($o in @($s.options)) {
    $btn = [Windows.Markup.XamlReader]::Parse($optionXaml)
    $grid = $btn.Content
    $grid.FindName('Key').Text = [string]($i + 1)
    $grid.FindName('Label').Text = [string]$o.label
    $detail = $grid.FindName('Detail')
    if ($o.detail) { $detail.Text = [string]$o.detail } else { $detail.Visibility = 'Collapsed' }
    if ($i -eq $s.recommended) {
      $grid.FindName('Pick').Visibility = 'Visible'
      $btn.BorderBrush = $brush.ConvertFromString('#EDEDED')
    } else {
      $btn.BorderBrush = $brush.ConvertFromString('#2A2A2A')
    }
    $btn.Tag = [string]$o.label
    $btn.Add_Click({ param($b, $e) Answer $b.Tag })
    [void]$list.Children.Add($btn)
    $picks += [string]$o.label
    $i++
  }
} else {
  Gone 'OptionList'; Gone 'FreeRow'; Gone 'Foot'
  if ($small) { Gone 'Line'; Gone 'Later'; Gone 'Hide'; (Part 'Title').FontSize = 14; (Part 'Title').Margin = '0,8,0,0' }
  (Part 'Primary').Content = if ($s.action) { [string]$s.action } else { 'Open' }
}

$free = Part 'Free'
function Answer($choice) {
  $note = $free.Text.Trim()
  $out = @()
  if ($choice) { $out += "choice: $choice" }
  if ($note) { $out += "text: $($note -replace '\s+', ' ')" }
  if ($out.Count) { Finish ($out -join "`n") }
}

$free.Add_TextChanged({ (Part 'FreeHint').Visibility = if ($free.Text) { 'Collapsed' } else { 'Visible' } })
$free.Add_GotKeyboardFocus({ (Part 'FreeBox').BorderBrush = $brush.ConvertFromString('#52A8FF') })
$free.Add_LostKeyboardFocus({ (Part 'FreeBox').BorderBrush = $brush.ConvertFromString('#2A2A2A') })
(Part 'Send').Add_Click({ Answer '' })
(Part 'Hide').Add_Click({ Finish 'later' })
(Part 'Later').Add_Click({ Finish 'later' })
(Part 'Primary').Add_Click({ Finish 'open' })
(Part 'OpenLink').Add_MouseLeftButtonUp({ Finish 'open' })

$win.Add_PreviewKeyDown({
  param($w, $e)
  if ($e.Key -eq 'Escape') { Finish 'later'; return }
  if ($free.IsKeyboardFocused) {
    if ($e.Key -eq 'Return') { Answer ''; $e.Handled = $true }
    return
  }
  $n = -1
  if ($e.Key -ge 'D1' -and $e.Key -le 'D9') { $n = [int]$e.Key - [int][System.Windows.Input.Key]::D1 }
  if ($e.Key -ge 'NumPad1' -and $e.Key -le 'NumPad9') { $n = [int]$e.Key - [int][System.Windows.Input.Key]::NumPad1 }
  if ($n -ge 0 -and $n -lt $picks.Count) { Answer $picks[$n] }
})

$win.Add_Loaded({
  if ($RenderTo) { return }
  $area = [System.Windows.SystemParameters]::WorkArea
  $win.Left = $area.Right - $win.ActualWidth - 6
  $win.Top = $area.Bottom - $win.ActualHeight - 6
  $fade = New-Object System.Windows.Media.Animation.DoubleAnimation(0, 1, [TimeSpan]::FromMilliseconds(200))
  $win.BeginAnimation([System.Windows.Window]::OpacityProperty, $fade)
  if (-not $small) { [System.Media.SystemSounds]::Asterisk.Play() }
})

$seconds = if ($s.seconds) { [int]$s.seconds } elseif ($small) { 8 } else { 300 }
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds($seconds)
$timer.Add_Tick({ $timer.Stop(); $win.Close() })
$timer.Start()

if ($RenderTo) {
  $win.Left = -5000; $win.Top = -5000; $win.Show()
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
