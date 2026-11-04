Attribute VB_Name = "modExportApp"
' =====================================================================
'  modExportApp · SAM MOTO-YA
'  Genera data.json para MOTO-YA app (precios, stock, gavetas,
'  aplicaciones y medidas de las motos).
'
'  Uso: botón "Exportar app" -> macro ExportarApp.
'  El archivo queda en la carpeta  ...\Moto-ya\MOTO-YA app\
'  (junto al SAM). Luego se sube data.json a GitHub.
'
'  Fotos: van en ...\MOTO-YA app\img\ con el código MOTO-YA como
'  nombre (R016.webp, R016.jpg o R016.png). Si la foto es solo de
'  referencia, se llama R016-ref.webp.
' =====================================================================
Option Explicit

Private Const CARPETA_APP As String = "MOTO-YA app"

Public Sub ExportarApp()
    Dim carpeta As String, archivo As String
    carpeta = ThisWorkbook.Path & "\" & CARPETA_APP
    If Dir(carpeta, vbDirectory) = "" Then MkDir carpeta
    If Dir(carpeta & "\img", vbDirectory) = "" Then MkDir carpeta & "\img"
    archivo = carpeta & "\data.json"

    Application.ScreenUpdating = False
    Application.Calculate

    Dim wsM As Worksheet, wsA As Worksheet, wsI As Worksheet, wsMo As Worksheet
    Set wsM = ThisWorkbook.Worksheets("MAESTRO_PRODUCTOS")
    Set wsA = ThisWorkbook.Worksheets("APLICACIONES")
    Set wsI = ThisWorkbook.Worksheets("INVENTARIO_MOVILES")
    Set wsMo = ThisWorkbook.Worksheets("MODELOS_MOTO")

    ' ---- Maestro (A:M desde fila 5) ----
    Dim maestro As Object: Set maestro = CreateObject("Scripting.Dictionary")
    Dim v As Variant, r As Long, ult As Long, c As String
    ult = UltimaFila(wsM, 1)
    If ult >= 5 Then
        v = wsM.Range("A5:K" & ult).Value
        For r = 1 To UBound(v, 1)
            c = Txt(v(r, 1))
            If c <> "" And Not maestro.Exists(c) Then
                maestro(c) = """c"":" & J(c) & ",""cp"":" & J(CodProv(v(r, 2))) & ",""d"":" & J(Txt(v(r, 3))) & _
                             ",""mk"":" & J(Txt(v(r, 4))) & ",""pr"":" & J(Txt(v(r, 6))) & _
                             ",""venta"":" & Num(v(r, 10)) & ",""promo"":" & Num(v(r, 11))
            End If
        Next r
    End If

    ' ---- Aplicaciones: derecha H:N (una fila por moto) ----
    Dim aplic As Object: Set aplic = CreateObject("Scripting.Dictionary")
    ult = UltimaFila(wsA, 8)
    If ult >= 5 Then
        v = wsA.Range("H5:N" & ult).Value
        For r = 1 To UBound(v, 1)
            c = Txt(v(r, 1))
            If c <> "" Then
                Dim ap As String
                ap = "[" & J(Txt(v(r, 4))) & "," & J(Txt(v(r, 5))) & "," & J(Txt(v(r, 6))) & "," & J(Txt(v(r, 7))) & "]"
                If aplic.Exists(c) Then aplic(c) = aplic(c) & "," & ap Else aplic(c) = ap
            End If
        Next r
    End If

    ' ---- Vehículos (fila 3: E, G, I, K, M, O) e inventario por ubicación ----
    Dim colVeh(1 To 6) As Long, nomVeh(1 To 6) As String, nVeh As Long, k As Long, nombre As String
    For k = 0 To 5
        nombre = LimpiarVehiculo(Txt(wsI.Cells(3, 5 + 2 * k).Value))
        If nombre <> "" Then
            nVeh = nVeh + 1: colVeh(nVeh) = 5 + 2 * k: nomVeh(nVeh) = nombre
        End If
    Next k
    Dim stock As Object: Set stock = CreateObject("Scripting.Dictionary")
    ult = UltimaFila(wsI, 1)
    If ult >= 5 Then
        v = wsI.Range("A5:P" & ult).Value
        For r = 1 To UBound(v, 1)
            c = Txt(v(r, 1))
            If c <> "" Then
                Dim sm As String, sg As String
                sm = "": sg = ""
                For k = 1 To nVeh
                    sm = sm & IIf(k > 1, ",", "") & Num(v(r, colVeh(k)))
                    sg = sg & IIf(k > 1, ",", "") & J(Txt(v(r, colVeh(k) + 1)))
                Next k
                stock(c) = "{""b"":" & Num(v(r, 4)) & ",""m"":[" & sm & "],""g"":[" & sg & "]}"
            End If
        Next r
    End If
    Dim stVacio As String, sv1 As String, sv2 As String
    For k = 1 To nVeh: sv1 = sv1 & IIf(k > 1, ",", "") & "0": sv2 = sv2 & IIf(k > 1, ",", "") & """""": Next k
    stVacio = "{""b"":0,""m"":[" & sv1 & "],""g"":[" & sv2 & "]}"

    ' ---- Fotos en la carpeta img ----
    Dim fotos As Object: Set fotos = CreateObject("Scripting.Dictionary")
    Dim f As String, base As String
    f = Dir(carpeta & "\img\*.*")
    Do While f <> ""
        Select Case LCase(Mid(f, InStrRev(f, ".") + 1))
            Case "webp", "jpg", "jpeg", "png"
                base = Left(f, InStrRev(f, ".") - 1)
                base = Replace(base, "-ref", "", , , vbTextCompare)
                fotos(UCase(base)) = f
        End Select
        f = Dir()
    Loop

    ' ---- Productos (izquierda de APLICACIONES: A:E) ----
    Dim sb As String, nProd As Long, nAp As Long
    ult = UltimaFila(wsA, 1)
    If ult >= 5 Then
        v = wsA.Range("A5:E" & ult).Value
        For r = 1 To UBound(v, 1)
            c = Txt(v(r, 1))
            If c <> "" And maestro.Exists(c) Then
                Dim est As String, p As String
                est = Txt(v(r, 5)): If est = "" Then est = "SIN VALIDAR"
                p = "{" & maestro(c) & ",""f"":" & J(Txt(v(r, 3))) & ",""ojo"":" & J(Txt(v(r, 4))) & ",""est"":" & J(est) & _
                    ",""ap"":[" & IIf(aplic.Exists(c), aplic(c), "") & "]" & _
                    ",""st"":" & IIf(stock.Exists(c), stock(c), stVacio)
                If fotos.Exists(UCase(c)) Then p = p & ",""img"":" & J(fotos(UCase(c)))
                p = p & "}"
                sb = sb & IIf(nProd > 0, "," & vbLf, "") & p
                nProd = nProd + 1
            End If
        Next r
    End If

    ' ---- Modelos de moto con medidas (A:G) ----
    Dim sm2 As String, nMod As Long
    ult = UltimaFila(wsMo, 1)
    If ult >= 5 Then
        v = wsMo.Range("A5:G" & ult).Value
        For r = 1 To UBound(v, 1)
            If Txt(v(r, 1)) <> "" And Txt(v(r, 2)) <> "" Then
                sm2 = sm2 & IIf(nMod > 0, "," & vbLf, "") & "[" & J(Txt(v(r, 1))) & "," & J(Txt(v(r, 2))) & "," & J(Txt(v(r, 3))) & "," & _
                      J(Txt(v(r, 4))) & "," & J(Txt(v(r, 5))) & "," & J(Txt(v(r, 6))) & "," & J(Txt(v(r, 7))) & "]"
                nMod = nMod + 1
            End If
        Next r
    End If

    ' ---- Armar el JSON ----
    Dim vehJ As String
    For k = 1 To nVeh: vehJ = vehJ & IIf(k > 1, ",", "") & J(nomVeh(k)): Next k
    Dim json As String
    json = "{""v"":" & J(Format(Now, "yyyymmddhhnnss")) & ",""corte"":" & J(FechaLarga(Now)) & _
           ",""veh"":[" & vehJ & "]," & vbLf & """p"":[" & vbLf & sb & vbLf & "]," & vbLf & """m"":[" & vbLf & sm2 & vbLf & "]}"

    GuardarUTF8 archivo, json
    Application.ScreenUpdating = True

    If MsgBox("Listo: data.json exportado." & vbCrLf & vbCrLf & _
              nProd & " productos · " & fotos.Count & " fotos · " & nMod & " modelos de moto" & vbCrLf & _
              "Vehículos: " & Replace(Replace(vehJ, """", ""), ",", ", ") & vbCrLf & vbCrLf & _
              "Ahora súbelo a GitHub (carpeta de la app) para que les llegue a los vendedores." & vbCrLf & vbCrLf & _
              "¿Abrir la carpeta?", vbYesNo + vbInformation, "MOTO-YA app") = vbYes Then
        Shell "explorer.exe """ & carpeta & """", vbNormalFocus
    End If
End Sub

' ---------- Ayudas ----------
Private Function UltimaFila(ws As Worksheet, col As Long) As Long
    Dim r As Long
    r = ws.Cells(ws.Rows.Count, col).End(xlUp).Row
    ' salta filas con fórmulas que devuelven ""
    Do While r > 4
        If Trim(CStr(ws.Cells(r, col).Value)) <> "" Then Exit Do
        r = r - 1
    Loop
    UltimaFila = r
End Function

Private Function Txt(x As Variant) As String
    If IsError(x) Then Txt = "": Exit Function
    If IsEmpty(x) Or IsNull(x) Then Txt = "": Exit Function
    Txt = Trim(CStr(x))
End Function

Private Function Num(x As Variant) As String
    Dim d As Double
    If IsError(x) Then Num = "0": Exit Function
    If IsNumeric(x) And Not IsEmpty(x) Then d = CDbl(x) Else d = 0
    Num = Replace(CStr(Round(d, 0)), ",", ".")
End Function

Private Function CodProv(x As Variant) As String
    If IsError(x) Or IsEmpty(x) Then CodProv = "": Exit Function
    If IsNumeric(x) Then
        If CDbl(x) = Int(CDbl(x)) Then CodProv = Format(CDbl(x), "0"): Exit Function
    End If
    CodProv = Trim(CStr(x))
End Function

' Quita el emoji y los espacios del inicio (emoji + " MOTOCARRO R2" -> "MOTOCARRO R2")
Private Function LimpiarVehiculo(s As String) As String
    Do While Len(s) > 0
        If Left(s, 1) Like "[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]" Then Exit Do
        s = Mid(s, 2)
    Loop
    LimpiarVehiculo = Trim(s)
End Function

' Texto JSON con comillas y caracteres especiales escapados
Private Function J(ByVal s As String) As String
    Dim i As Long, ch As String, code As Long, out As String
    For i = 1 To Len(s)
        ch = Mid(s, i, 1): code = AscW(ch)
        Select Case code
            Case 34: out = out & "\"""
            Case 92: out = out & "\\"
            Case 10: out = out & "\n"
            Case 13: ' se omite
            Case 9: out = out & " "
            Case 0 To 31: out = out & " "
            Case Else: out = out & ch
        End Select
    Next i
    J = """" & out & """"
End Function

Private Function FechaLarga(d As Date) As String
    Dim meses As Variant
    meses = Array("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre")
    FechaLarga = Day(d) & " de " & meses(Month(d) - 1) & " de " & Year(d) & ", " & Format(d, "hh:nn")
End Function

' Guarda en UTF-8 sin BOM
Private Sub GuardarUTF8(ruta As String, texto As String)
    Dim st As Object, bin As Object
    Set st = CreateObject("ADODB.Stream")
    st.Type = 2: st.Charset = "utf-8": st.Open
    st.WriteText texto
    st.Position = 3                      ' salta el BOM
    Set bin = CreateObject("ADODB.Stream")
    bin.Type = 1: bin.Open
    st.CopyTo bin
    bin.SaveToFile ruta, 2
    bin.Close: st.Close
End Sub
