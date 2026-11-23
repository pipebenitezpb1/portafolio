# Script para Autodesk Fusion.  NO PROBADO en Fusion: se escribio sin poder ejecutarlo.
#
# Construye el estuche tipo navaja DENTRO de Fusion, paso a paso, para que la linea de tiempo
# guarde el proceso.  Cada paso de proceso.json es: un boceto con un perfil plano, y una
# extrusion que crea un cuerpo, le suma o le resta.  Por cada pieza queda un grupo en la
# linea de tiempo con su nombre.  Ademas pone la foto como lienzo y dibuja el calcado.
# Todo queda como cuerpos en la raiz (sin componentes).
#
# Uso: abrir un diseno nuevo > Utilidades > Complementos > Scripts y complementos > "+" >
#      elegir esta carpeta > Ejecutar.  Son 162 pasos: puede tardar unos minutos.
# El lienzo queda con el tamano por defecto de Fusion; para dejarlo a escala:
#      clic derecho > Calibrar > clic en las dos cruces rojas > 200 mm.
import adsk.core, adsk.fusion, traceback, os, json

AGRUPAR_POR_PIEZA = True     # False = dejar todos los pasos sueltos en la linea de tiempo, sin grupos


def run(context):
    app = adsk.core.Application.get()
    ui = app.userInterface
    avisos = []
    try:
        carpeta = os.path.dirname(os.path.realpath(__file__))
        datos = json.load(open(os.path.join(carpeta, 'proceso.json')))
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox('Abre primero un diseno (espacio de trabajo Diseno).')
            return
        try:
            design.designType = adsk.fusion.DesignTypes.ParametricDesignType   # con historial
        except:
            pass
        root = design.rootComponent
        tl = design.timeline
        VI = adsk.core.ValueInput.createByReal
        OPS = {'nuevo': adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
               'sumar': adsk.fusion.FeatureOperations.JoinFeatureOperation,
               'restar': adsk.fusion.FeatureOperations.CutFeatureOperation}

        planos = {}

        def plano(z_mm):                      # plano paralelo a XY a la altura z (Fusion trabaja en cm)
            k = round(z_mm, 3)
            if abs(k) < 1e-6:
                return root.xYConstructionPlane
            if k not in planos:
                pi = root.constructionPlanes.createInput()
                pi.setByOffset(root.xYConstructionPlane, VI(k / 10.0))
                pl = root.constructionPlanes.add(pi)
                try:
                    pl.name = 'Altura %.2f mm' % k
                    pl.isLightBulbOn = False
                except:
                    pass
                planos[k] = pl
            return planos[k]

        def dibujar(sk, lazos, z_mm):
            P = lambda p: sk.modelToSketchSpace(adsk.core.Point3D.create(p[0] / 10.0, p[1] / 10.0, z_mm / 10.0))
            cur = sk.sketchCurves
            for lazo in lazos:
                for tr in lazo:
                    if tr[0] == 'l':
                        cur.sketchLines.addByTwoPoints(P(tr[1]), P(tr[2]))
                    elif tr[0] == 'a':
                        cur.sketchArcs.addByThreePoints(P(tr[1]), P(tr[2]), P(tr[3]))
                    else:
                        col = adsk.core.ObjectCollection.create()
                        for p in tr[1]:
                            col.add(P(p))
                        cur.sketchFittedSplines.add(col)

        def agrupar(inicio, nombre):
            if not AGRUPAR_POR_PIEZA:
                return
            try:
                fin = tl.markerPosition - 1
                if fin > inicio:
                    gr = tl.timelineGroups.add(inicio, fin)
                    gr.name = nombre
            except:
                pass

        # ---- 0. foto y calcado ----
        inicio = tl.markerPosition
        try:
            lienzo = root.canvases.add(root.canvases.createInput(os.path.join(carpeta, 'foto_para_lienzo.png'), root.xYConstructionPlane))
            try:
                lienzo.name = 'Foto de la llave'
            except:
                pass
        except:
            avisos.append('No se pudo insertar el lienzo; insertalo a mano: Insertar > Lienzo > foto_para_lienzo.png.')
        sk = root.sketches.add(root.xYConstructionPlane)
        sk.name = 'Calcado de la llave sobre la foto'
        sk.isComputeDeferred = True
        dibujar(sk, [[['l', t[0], t[1]] if len(t) == 2 else ['s', t] for t in datos['calcado']['llave']]], 0)
        dibujar(sk, [[['l', t[0], t[1]] if len(t) == 2 else ['s', t] for t in datos['calcado']['vaciado']]], 0)
        sk.sketchPoints.add(adsk.core.Point3D.create(0, 0, 0))
        sk.sketchPoints.add(adsk.core.Point3D.create(20.0, 0, 0))
        sk.isComputeDeferred = False
        agrupar(inicio, '00 Foto y calcado')

        # ---- piezas, paso a paso ----
        cuerpos = {}
        pieza_actual, inicio = None, tl.markerPosition
        barra = ui.createProgressDialog()
        barra.show('Estuche navaja', 'Paso %v de %m', 0, len(datos['pasos']), 1)
        for n, q in enumerate(datos['pasos']):
            if barra.wasCancelled:
                break
            barra.progressValue = n + 1
            adsk.doEvents()
            if q['pieza'] != pieza_actual:
                if pieza_actual is not None:
                    agrupar(inicio, pieza_actual)
                pieza_actual, inicio = q['pieza'], tl.markerPosition
            try:
                zm, alto = (q['z0'] + q['z1']) / 2.0, q['z1'] - q['z0']
                sk = root.sketches.add(plano(zm))
                sk.name = q['nombre']
                sk.isComputeDeferred = True
                dibujar(sk, q['lazos'], zm)
                sk.isComputeDeferred = False
                mejor = None                  # el perfil cuya area coincide con la del paso
                for i in range(sk.profiles.count):
                    pr = sk.profiles.item(i)
                    dif = abs(pr.areaProperties().area * 100.0 - q['area'])
                    if mejor is None or dif < mejor[0]:
                        mejor = (dif, pr)
                if mejor is None or mejor[0] > 0.05 * q['area'] + 0.5:
                    avisos.append('%s / %s: no se encontro el perfil.' % (q['pieza'], q['nombre']))
                    continue
                ent = root.features.extrudeFeatures.createInput(mejor[1], OPS[q['op']])
                ent.setSymmetricExtent(VI(alto / 10.0), True)      # el boceto esta a media altura
                if q['op'] != 'nuevo':
                    ent.participantBodies = [cuerpos[q['pieza']]]
                ex = root.features.extrudeFeatures.add(ent)
                try:
                    ex.name = q['nombre']
                    sk.isVisible = False
                except:
                    pass
                if q['op'] == 'nuevo':
                    cuerpos[q['pieza']] = ex.bodies.item(0)
                    cuerpos[q['pieza']].name = q['pieza']
                elif ex.bodies.count > 0:
                    cuerpos[q['pieza']] = ex.bodies.item(0)
            except:
                avisos.append('%s / %s: %s' % (q['pieza'], q['nombre'], traceback.format_exc().strip().split('\n')[-1]))
        if pieza_actual is not None:
            agrupar(inicio, pieza_actual)
        barra.hide()
        app.activeViewport.fit()
        ui.messageBox('Terminado: %d cuerpos.\n\nPara dejar la foto a escala: clic derecho en el lienzo > Calibrar, '
                      'clic en las dos cruces rojas y escribir 200 mm.\n\n%s' % (
                          len(cuerpos), ('Avisos (%d):\n' % len(avisos) + '\n'.join(avisos[:25])) if avisos else 'Sin avisos.'))
    except:
        if ui:
            ui.messageBox('Fallo:\n{}'.format(traceback.format_exc()))
