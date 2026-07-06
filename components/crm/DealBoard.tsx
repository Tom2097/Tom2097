"use client";

import { useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Plus, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";

// Types for deal stages and deal data
type DealStage = "Lead" | "Contacted" | "Proposal" | "Negotiation" | "Won" | "Lost";

interface Deal {
  id: string;
  name: string;
  value: number;
  probability: number;
  expectedCloseDate: Date;
  contacts: string[]; // Contact IDs
  stage: DealStage;
}

interface DealBoardProps {
  deals: Deal[];
  onStageChange: (dealId: string, newStage: DealStage) => void;
  onAddDeal: (stage: DealStage) => void;
}

// Stage configuration
const STAGES: DealStage[] = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];

const DealBoard = ({ deals, onStageChange, onAddDeal }: DealBoardProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter deals based on search term
  const filteredDeals = deals.filter(deal =>
    deal.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Group deals by stage
  const dealsByStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = filteredDeals.filter(deal => deal.stage === stage);
      return acc;
    },
    {} as Record<DealStage, Deal[]>,
  );

  // Handle drag-and-drop
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      const { draggableId, source, destination } = result;
      if (source.droppableId === destination.droppableId) return;

      const newStage = destination.droppableId as DealStage;
      onStageChange(draggableId, newStage);
    },
    [onStageChange],
  );

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Deal Pipeline</h1>
        <input
          type="text"
          placeholder="Search deals..."
          className="px-3 py-2 border rounded-md"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {STAGES.map(stage => (
            <Droppable key={stage} droppableId={stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-lg p-2 min-h-[80vh] ${snapshot.isDraggingOver ? "bg-gray-100" : "bg-gray-50"}`}
                >
                  <Card className="h-full">
                    <CardHeader className="flex flex-row justify-between items-center pb-2">
                      <CardTitle className="text-sm font-medium">{stage}</CardTitle>
                      <Badge variant="secondary">
                        {dealsByStage[stage].length}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {dealsByStage[stage].map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 border rounded-md bg-white ${snapshot.isDragging ? "shadow-lg" : "shadow-sm"}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-medium">{deal.name}</h3>
                                  <p className="text-sm text-gray-500">
                                    {new Intl.NumberFormat('en-IN', {
                                      style: 'currency',
                                      currency: 'INR',
                                    }).format(deal.value)}
                                  </p>
                                </div>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-2 flex justify-between text-xs text-gray-500">
                                <span>{deal.probability}% probability</span>
                                <span>
                                  {format(deal.expectedCloseDate, "MMM dd")}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {deal.contacts.map(contact => (
                                  <Badge key={contact} variant="outline" className="text-xs">
                                    {contact}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => onAddDeal(stage)}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Add Deal
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default DealBoard;