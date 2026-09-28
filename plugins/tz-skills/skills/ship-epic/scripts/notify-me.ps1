# Shows a small card at the bottom-right of the screen and prints "clicked" or "timeout".
# Changes no system setting: no volume, no notification preference.
param(
  [string]$Title = "Claude needs you",
  [string]$Message = "A session has a question.",
  [string]$Tag = "QUESTION",
  [int]$Seconds = 300
)

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ShowActivated="False"
        SizeToContent="Height" Width="380" ResizeMode="NoResize">
  <Border x:Name="Card" CornerRadius="14" Background="#1F1E1A" BorderBrush="#3A372F"
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
      <TextBlock x:Name="TitleText" FontFamily="Segoe UI Semibold" FontSize="17"
                 Foreground="#ECE7DC" TextWrapping="Wrap" Margin="0,12,0,0"/>
      <TextBlock x:Name="BodyText" FontFamily="Segoe UI" FontSize="13.5" Foreground="#C9C3B5"
                 TextWrapping="Wrap" Margin="0,6,0,0" LineHeight="20"/>
      <Button x:Name="Ok" Content="Got it" HorizontalAlignment="Right" Margin="0,16,0,0"
              Padding="18,7,18,7" FontFamily="Segoe UI Semibold" FontSize="13"
              Foreground="#1F1E1A" Background="#D9955F" BorderThickness="0" Cursor="Hand">
        <Button.Template>
          <ControlTemplate TargetType="Button">
            <Border x:Name="B" CornerRadius="8" Background="{TemplateBinding Background}"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="B" Property="Background" Value="#E8AB7A"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Button.Template>
      </Button>
    </StackPanel>
  </Border>
</Window>
'@

$win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $xaml))
$win.FindName('TagText').Text = $Tag.ToUpper()
$win.FindName('Clock').Text = (Get-Date).ToString('HH:mm')
$win.FindName('TitleText').Text = $Title
$win.FindName('BodyText').Text = $Message

$script:result = 'timeout'
$win.FindName('Ok').Add_Click({ $script:result = 'clicked'; $win.Close() })

$win.Add_Loaded({
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

[void]$win.ShowDialog()
$script:result
